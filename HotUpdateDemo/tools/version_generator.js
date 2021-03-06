var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
const jetpack = require('fs-jetpack');

var manifest = {
    packageUrl: 'http://localhost/tutorial-hot-update/remote-assets/',
    remoteManifestUrl: 'http://localhost/tutorial-hot-update/remote-assets/project.manifest',
    remoteVersionUrl: 'http://localhost/tutorial-hot-update/remote-assets/version.manifest',
    version: '1.0.0',
    assets: {},
    searchPaths: []
};

var dest = './remote-assets/';
var src = './jsb/';
var hotDir = null;
var packageRes = null;
// Parse arguments
var i = 2;
while (i < process.argv.length) {
    var arg = process.argv[i];

    switch (arg) {
        case '--url':
        case '-u':
            var url = process.argv[i + 1];
            manifest.packageUrl = url;
            manifest.remoteManifestUrl = url + 'project.manifest';
            manifest.remoteVersionUrl = url + 'version.manifest';
            i += 2;
            break;
        case '--version':
        case '-v':
            manifest.version = process.argv[i + 1];
            console.log('version=', manifest.version);
            i += 2;
            break;
        case '--src':
        case '-s':
            src = process.argv[i + 1];
            hotDir = path.join(src, 'hotUpdate');
            console.log('hotDir=', hotDir);
            packageRes = path.join(src, 'res');
            console.log('hpackageRes', packageRes);
            i += 2;
            break;
        case '--dest':
        case '-d':
            dest = process.argv[i + 1];
            i += 2;
            break;
        default:
            i += 2;
            break;
    }
}

/**
 * 读取文件到obj中
 * 过滤渠道json
 * @param {*} dir 
 * @param {*} obj 
 */
function readDir(dir, obj) {
    console.log('readDir = ', dir);
    var stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
        return;
    }
    var subpaths = fs.readdirSync(dir),
        subpath, size, md5, compressed, relative;
    for (var i = 0; i < subpaths.length; ++i) {
        if (subpaths[i][0] === '.') {
            continue;
        }
        if (subpaths[i] == 'channel.json') {
            console.log('---------------channel.json-------------------');
            continue;
        }
        subpath = path.join(dir, subpaths[i]);
        stat = fs.statSync(subpath);
        if (stat.isDirectory()) {
            readDir(subpath, obj);
        } else if (stat.isFile()) {
            // Size in Bytes
            size = stat['size'];
            console.log('md5 ', subpath);
            // md5 = crypto.createHash('md5').update(fs.readFileSync(subpath, 'binary')).digest('hex');//返回的并非二进制类型，而是String。这会导致非文本文件md5计算错误
            md5 = crypto.createHash('md5').update(fs.readFileSync(subpath)).digest('hex'); //
            compressed = path.extname(subpath).toLowerCase() === '.zip';

            relative = path.relative(src, subpath);
            relative = relative.replace(/\\/g, '/');
            relative = encodeURI(relative);
            obj[relative] = {
                'size': size,
                'md5': md5
            };
            if (compressed) {
                obj[relative].compressed = true;
            }
        }
    }
}

//创建文件夹
var mkdirSync = function (path) {
    try {
        fs.mkdirSync(path);
    } catch (e) {
        if (e.code != 'EEXIST') throw e;
    }
};

// Iterate res and src folder
readDir(path.join(src, 'src'), manifest.assets);
readDir(path.join(src, 'res'), manifest.assets);

var hotManifest = path.join(hotDir, 'project.manifest');
var hotVersion = path.join(hotDir, 'version.manifest');
var tmp = path.join(packageRes, 'raw-assets');
var packageMenifest = path.join(tmp, 'project.manifest');
console.log('packageMenifest', packageMenifest);
mkdirSync(dest);
//生成热更新目录
mkdirSync(hotDir);


//生成文件manifest转成hotProject.js
let hotProjectPath = path.join(dest, 'hotManifest.js');
console.log('create hotProject', hotProjectPath);
isfailed = fs.writeFileSync(hotProjectPath, 'module.exports = ' + JSON.stringify(manifest));
if (!isfailed) {
    console.log('hotManifest successfully generated');
}

//生成文件manifest到hotUpdate
isfailed = fs.writeFileSync(hotManifest, JSON.stringify(manifest));
if (!isfailed) {
    console.log('hotManifest successfully generated');
}

delete manifest.assets;
delete manifest.searchPaths;

//生成版本manifest到hotUpdate
isfailed = fs.writeFileSync(hotVersion, JSON.stringify(manifest));
if (isfailed) {
    console.log('hotVersion successfully generated');
}
/*
 * 复制目录、子目录，及其中的文件
 * @param src {String} 要复制的目录
 * @param dist {String} 复制到目标目录
 */
function copyDirSync(path, dest) {
    let flist = jetpack.list(path)
    for (let i = 0; i < flist.length; i++) {
        let absolutePath = `${path}/${flist[i]}`
        if (jetpack.exists(absolutePath) == "file") { // 是文件则复制
            jetpack.copy(absolutePath, `${dest}/${flist[i]}`, {
                overwrite: true
            });
        }
        if (jetpack.exists(absolutePath) == "dir") { // 是目录则递归
            copyDirSync(absolutePath, `${dest}/${flist[i]}`)
        }
    }
}

/**
 * 删除目录
 */
var rmdirSync = (function () {
    /**
     * 删除文件，如果是目录加入dirs 且进入
     * inner函数 
     * @param {*} url 
     * @param {*} dirs 
     */
    function iterator(url, dirs) {
        var stat = fs.statSync(url);
        if (stat.isDirectory()) {
            //收集目录
            dirs.unshift(url);
            inner(url, dirs);
        } else if (stat.isFile()) {
            fs.unlinkSync(url);
        }
    }
    /**
     * 
     * @param {*} path 
     * @param {*} dirs 
     */
    function inner(path, dirs) {
        var arr = fs.readdirSync(path);
        for (var i = 0; i < arr.length; i++) {
            iterator(path + '/' + arr[i], dirs);
        }
    }
    return function (dir, cb) {
        cb = cb || function () {};
        var dirs = [];
        try {
            //删除文件，得到目录
            iterator(dir, dirs);
            //一次性删除所有收集到的目录
            for (var i = 0; i < dirs.length; i++) {
                fs.rmdirSync(dirs[i]);
            }
            cb();
        } catch (error) {
            //如果文件或目录本来就不存在，fs.statSync会报错，不过我们还是当成没有异常发生
            error.code === 'ENOENT' ? cb() : cb(error);
        }
    };
})();

const srcPath = path.join(src, 'src');
const resPath = path.join(src, 'res');
const distSrcPath = path.join(hotDir, 'src');
const distResPath = path.join(hotDir, 'res');

//复制src目录前，先删除原有目录
rmdirSync(distSrcPath, (err) => {
    err && console.log('err=', err);
    console.log('delete success');
});

//复制res目录前，先删除原有目录
rmdirSync(distResPath, (err) => {
    err && console.log('err=', err);
    console.log('delete success');
});

//复制src目录
copyDirSync(srcPath, distSrcPath);
console.log('copy finish ', srcPath);

//复制res目录
copyDirSync(resPath, distResPath);
console.log('copy finish ', resPath);

//把生成的maifest 同步到build\jsb-xxx\res\raw-assets 而不需要再次构建重新生成
fs.writeFileSync(packageMenifest, fs.readFileSync(hotManifest));
console.log(`copy hotupdate to ${packageMenifest} successful`);

console.log('build hotupdte finish');