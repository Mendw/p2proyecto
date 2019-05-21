function sha256(plaintext) {
    return sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(plaintext))
}

function generateKeyPair() {
    let pair = sjcl.ecc.ecdsa.generateKeys(256)

    return {
        public: ,
        private:,
    }
}

function sign(plaintext, privateKey) {

}