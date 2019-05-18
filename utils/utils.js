const ipre = /\b(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\b/

function isIP(ip) {
    return ipre.test(ip)
}

module.exports = exports = {
    isIp: isIP,
    hello: "Hello",
}