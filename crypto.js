class BitcoinWallet {
    constructor() {
        try {
            console.log('Initializing BitcoinWallet...');
            // Make sure elliptic is available
            if (typeof elliptic === 'undefined') {
                throw new Error('elliptic library not loaded');
            }
            // Initialize elliptic curve
            this.ec = new elliptic.ec('secp256k1');
            console.log('BitcoinWallet initialized successfully');
        } catch (error) {
            console.error('Failed to initialize BitcoinWallet:', error);
            throw error;
        }
    }

    // Generate private key from phrase using SHA-256
    generatePrivateKey(phrase) {
        try {
            const hash = CryptoJS.SHA256(phrase);
            return hash.toString();
        } catch (error) {
            console.error('Error generating private key:', error);
            throw error;
        }
    }

    // Generate public key from private key
    generatePublicKey(privateKey) {
        try {
            const keyPair = this.ec.keyFromPrivate(privateKey);
            return keyPair.getPublic().encode('hex');
        } catch (error) {
            console.error('Error generating public key:', error);
            throw error;
        }
    }

    // Generate Bitcoin address from public key
    generateAddress(publicKey) {
        try {
            // Step 1: SHA-256 hash of the public key
            const sha256 = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKey));
            
            // Step 2: RIPEMD160 hash of the result
            const ripemd160 = CryptoJS.RIPEMD160(sha256);
            
            // Step 3: Add version byte in front (0x00 for mainnet)
            const versionByte = '00';
            const versionAndRipemd160 = versionByte + ripemd160.toString();
            
            // Step 4: Double SHA-256 hash of the result
            const firstSHA = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(versionAndRipemd160));
            const secondSHA = CryptoJS.SHA256(firstSHA);
            
            // Step 5: Take the first 4 bytes of the second SHA-256 hash for checksum
            const checksum = secondSHA.toString().substring(0, 8);
            
            // Step 6: Add the 4 checksum bytes to the version+RIPEMD160 hash
            const binaryAddress = versionAndRipemd160 + checksum;
            
            // Step 7: Convert to base58
            const address = this.base58Encode(binaryAddress);
            
            return address;
        } catch (error) {
            console.error('Error generating address:', error);
            throw error;
        }
    }

    // Base58 encoding function
    base58Encode(hex) {
        try {
            if (typeof Buffer === 'undefined') {
                throw new Error('Buffer is not defined');
            }
            if (typeof bs58 === 'undefined') {
                throw new Error('bs58 is not defined');
            }
            const bytes = Buffer.from(hex, 'hex');
            return bs58.encode(bytes);
        } catch (error) {
            console.error('Error in base58 encoding:', error);
            throw error;
        }
    }

    // Generate wallet from phrase
    generateWallet(phrase) {
        try {
            const privateKey = this.generatePrivateKey(phrase);
            const publicKey = this.generatePublicKey(privateKey);
            const address = this.generateAddress(publicKey);
            
            return {
                phrase,
                privateKey,
                publicKey,
                address
            };
        } catch (error) {
            console.error('Error generating wallet:', error);
            throw error;
        }
    }
}

// Predefined templates and components for phrase generation
const templates = [
    'bitcoingenesis{year}',
    'satoshinakamoto{year}',
    'whitepaper{month}{year}',
    'DOUBLEMINERPUBLIC{num}',
    'rewardprivatenonce{special}',
    'scripttarget{special}',
    'DISCUSSIONPREVIOUSMININGTHREAD',
    'TOPICCASH{special}',
    'hashdecentralizedmerklescriptmail',
    'signatureopenspokenquerysystem'
];

const components = {
    years: ['2008', '2009', '2010', '2011', '2012'],
    months: ['01', '03', '05', '08', '10', '12'],
    specials: ['#', '@', '$', '&', '*', '!'],
    nums: ['0402', '0515', '0901', '1204', '21000000', '10000', '50']
};

// Phrase generator class
class PhraseGenerator {
    constructor() {
        this.templates = templates;
        this.components = components;
    }

    // Generate a phrase using a random template
    generatePhrase() {
        const template = this.templates[Math.floor(Math.random() * this.templates.length)];
        
        return template.replace(/{(\w+)}/g, (match, component) => {
            const componentArray = this.components[component];
            if (!componentArray) return match;
            return componentArray[Math.floor(Math.random() * componentArray.length)];
        });
    }

    // Generate multiple phrases
    generatePhrases(count) {
        const phrases = [];
        for (let i = 0; i < count; i++) {
            phrases.push(this.generatePhrase());
        }
        return phrases;
    }
} 