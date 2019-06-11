const sjcl = require('./sjcl')

function deserialize(public) {
    return new sjcl.ecc.ecdsa.publicKey(
        sjcl.ecc.curves.c256,
        sjcl.codec.base64.toBits(public)
    )
}

function verify(data) {
    if (!data) {
        return false
    }


    let plaintext = `${data.username}${data.public}${data.timestamp}`
    let signature = sjcl.codec.base64.toBits(data.signature)
    let public = deserialize(data.public)

    try {
        return public.verify(sjcl.hash.sha256.hash(plaintext), signature)
    } catch (err) {
        return false
    }
}

function hexHash(plaintext) {
    return sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(plaintext))
}

function b64Hash(plaintext) {
    return sjcl.codec.base64.fromBits(sjcl.hash.sha256.hash(plaintext))
}

module.exports = exports = {
    verify: verify,
    hash: hexHash,
}