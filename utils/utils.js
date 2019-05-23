var http = require('https')

const ipre = /\b(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\b/

function isIP(ip) {
    return ipre.test(ip)
}

function getPublicIP(callback) {
    http.get('https://api.ipify.org', res => {
        const { statusCode } = res
        let error;
        if (statusCode !== 200) {
            error = new Error('Request Failed.\n' +
                `Status Code: ${statusCode}`);
        }
        if (error) {
            console.error(error.message);
            res.resume();
            return;
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });

        res.on('end', () => {
            console.log(rawData)
            callback(rawData)
        })
    })
}


function verify(plaintext, signed, publicKey) {
    try {
        return publicKey.verify(sjcl.hash.sha256.hash(plaintext), signed)
    } catch (error) {
        console.dir(error)
        return false;
    }
}


module.exports = exports = {
    isIp: isIP,
    getPublicIP: getPublicIP,
}