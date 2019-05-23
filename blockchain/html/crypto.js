function sha256(plaintext) {
    return sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(plaintext))
}

function generateKeyPair() {
    let pair = sjcl.ecc.ecdsa.generateKeys(256)
    let pub = pair.pub.get(), sec = pair.sec.get()

    return {
        public: pub,
        secret: sec,
    }
}

function serialize(pair) {
    return {
        public: sjcl.codec.base64.fromBits(pair.public.x.concat(pair.public.y)),
        secret: sjcl.codec.base64.fromBits(pair.secret)
    }
}

function deserialize(serializedPair){
    return {
        public: new sjcl.ecc.ecdsa.publicKey(
            sjcl.ecc.curves.c256,
            sjcl.codec.base64.toBits(serializedPair.public)
        ),
        secret: new sjcl.ecc.ecdsa.secretKey(
            sjcl.ecc.curves.c256,
            sjcl.ecc.curves.c256.field.fromBits(sjcl.codec.base64.toBits(serializedPair.secret))
        )
    }
}

function sign(plaintext, secretKey) {
    return secretKey.sign(sjcl.hash.sha256.hash(plaintext))
}

function verify(plaintext, signed, publicKey) {
    try {
        return publicKey.verify(sjcl.hash.sha256.hash(plaintext), signed)
    } catch (error) {
        console.dir(error)
        return false;
    }
}
