var http = require('https')

const ipre = /\b(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\b/
const dns = require('dns')
const os = require('os')


function getLocalIP (callback) {
    dns.lookup(os.hostname(), (err, add, fam) => {
        callback(add)
    })
}

function isIP(ip) {
    return ipre.test(ip)
}

function getPublicIP(callback) {
    callback(ip)
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

module.exports = exports = {
    isIp: isIP,
    getPublicIP: getPublicIP,
    getLocalIP: getLocalIP
}