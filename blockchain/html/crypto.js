function sha256(plaintext) {
    return sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(plaintext))
}

function sign() {

}