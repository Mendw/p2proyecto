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

function serialize(public, secret) {
    if(public) public = sjcl.codec.base64.fromBits(public.get().x.concat(public.y))
    if(secret) secret = sjcl.codec.base64.fromBits(secret.get())
    return {
        public: public,
        secret: secret,
    }
}

function sign(plaintext, secretKey) {
    return sjcl.codec.base64.fromBits(secretKey.sign(sjcl.hash.sha256.hash(plaintext)))
}
