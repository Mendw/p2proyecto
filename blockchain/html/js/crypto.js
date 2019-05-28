function sha256(plaintext) {
    return sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(plaintext))
}

function generateKeyPair() {
    let pair = sjcl.ecc.ecdsa.generateKeys(256)

    return {
        public: pair.pub,
        secret: pair.sec,
    }
}

function deserialize(secret) {
    return new sjcl.ecc.ecdsa.secretKey(
        sjcl.ecc.curves.c256,
        sjcl.ecc.curves.c256.field.fromBits(sjcl.codec.base64.toBits(secret))
    )
}

function serialize(pair) {
    if (!pair) return
    let public = pair.public, secret = pair.secret
    if (public) public = sjcl.codec.base64.fromBits(public.get().x.concat(public.get().y))
    if (secret) secret = sjcl.codec.base64.fromBits(secret.get())
    return {
        public: public,
        secret: secret,
    }
}

function sign(plaintext, secretKey) {
    console.dir(secretKey)
    return sjcl.codec.base64.fromBits(secretKey.sign(sjcl.hash.sha256.hash(plaintext)))
}
