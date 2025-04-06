class BitcoinWallet {
    constructor() {
        try {
            console.log('Initializing BitcoinWallet...');
            
            // Check for required libraries
            if (typeof elliptic === 'undefined') {
                console.error('elliptic library status:', typeof elliptic);
                throw new Error('elliptic library not loaded');
            }
            if (typeof CryptoJS === 'undefined') {
                console.error('CryptoJS library status:', typeof CryptoJS);
                throw new Error('CryptoJS library not loaded');
            }
            if (typeof Buffer === 'undefined') {
                console.error('Buffer library status:', typeof Buffer);
                throw new Error('Buffer not loaded');
            }

            // Initialize elliptic curve
            this.ec = new elliptic.ec('secp256k1');
            
            // Log successful initialization
            console.log('Required libraries loaded:', {
                elliptic: typeof elliptic,
                CryptoJS: typeof CryptoJS,
                Buffer: typeof Buffer
            });
            console.log('Elliptic curve initialized:', this.ec !== undefined);
            console.log('BitcoinWallet initialized successfully');
        } catch (error) {
            console.error('Failed to initialize BitcoinWallet:', error);
            throw new Error(`Ошибка инициализации: ${error.message}`);
        }
    }

    // Generate private key from phrase using SHA-256
    generatePrivateKey(phrase) {
        try {
            console.log('Generating private key from phrase...');
            if (!phrase) {
                throw new Error('Пустая фраза');
            }
            
            // Convert phrase to WordArray
            const wordArray = CryptoJS.enc.Utf8.parse(phrase);
            // Generate SHA256 hash
            const hash = CryptoJS.SHA256(wordArray);
            // Convert to hex string
            const privateKey = hash.toString(CryptoJS.enc.Hex);
            
            console.log('Private key generated successfully');
            return privateKey;
        } catch (error) {
            console.error('Error generating private key:', error);
            throw new Error(`Ошибка генерации приватного ключа: ${error.message}`);
        }
    }

    // Generate public key from private key
    generatePublicKey(privateKeyHex) {
        try {
            console.log('Generating public key...');
            if (!privateKeyHex) {
                throw new Error('Пустой приватный ключ');
            }
            
            // Create key pair from private key
            const keyPair = this.ec.keyFromPrivate(privateKeyHex, 'hex');
            // Get public key in compressed format
            const publicKey = keyPair.getPublic(true, 'hex');
            
            console.log('Public key generated successfully');
            return publicKey;
        } catch (error) {
            console.error('Error generating public key:', error);
            throw new Error(`Ошибка генерации публичного ключа: ${error.message}`);
        }
    }

    // Generate Bitcoin address from public key
    generateAddress(publicKeyHex) {
        try {
            console.log('Generating Bitcoin address...');
            if (!publicKeyHex) {
                throw new Error('Пустой публичный ключ');
            }
            
            // Step 1: SHA-256 of public key
            const sha256 = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKeyHex));
            
            // Step 2: RIPEMD-160 of SHA-256
            const ripemd160 = CryptoJS.RIPEMD160(sha256);
            
            // Step 3: Add version byte (0x00 for mainnet)
            const versionByte = '00';
            const versionAndHash = versionByte + ripemd160.toString();
            
            // Step 4: Double SHA-256 for checksum
            const firstSHA = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(versionAndHash));
            const secondSHA = CryptoJS.SHA256(firstSHA);
            
            // Step 5: Take first 4 bytes of double SHA-256 as checksum
            const checksum = secondSHA.toString().substring(0, 8);
            
            // Step 6: Add checksum to version + hash
            const binaryAddress = versionAndHash + checksum;
            
            // Step 7: Convert to base58
            const bytes = Buffer.from(binaryAddress, 'hex');
            const address = this.base58Encode(bytes);
            
            console.log('Bitcoin address generated successfully');
            return address;
        } catch (error) {
            console.error('Error generating address:', error);
            throw new Error(`Ошибка генерации адреса: ${error.message}`);
        }
    }

    // Base58 encoding alphabet
    base58Encode(buffer) {
        const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let num = BigInt('0x' + buffer.toString('hex'));
        const base = BigInt(58);
        const zero = BigInt(0);
        let result = '';
        
        while (num > zero) {
            const remainder = Number(num % base);
            result = ALPHABET[remainder] + result;
            num = num / base;
        }
        
        // Add leading zeros
        for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
            result = '1' + result;
        }
        
        return result;
    }

    // Generate address from private key
    generateAddressFromPrivateKey(privateKeyHex) {
        try {
            const publicKey = this.generatePublicKey(privateKeyHex);
            return this.generateAddress(publicKey);
        } catch (error) {
            console.error('Error generating address from private key:', error);
            throw error;
        }
    }

    // Validate private key
    validatePrivateKey(privateKeyHex) {
        try {
            // Check if private key is a valid hex string
            if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
                return {
                    isValid: false,
                    reason: 'Private key must be 32 bytes (64 hex characters)'
                };
            }

            try {
                // Try to create key pair
                const keyPair = this.ec.keyFromPrivate(privateKeyHex, 'hex');
                return {
                    isValid: true,
                    publicKey: keyPair.getPublic(true, 'hex')
                };
            } catch (e) {
                return {
                    isValid: false,
                    reason: 'Invalid private key format'
                };
            }
        } catch (error) {
            console.error('Error validating private key:', error);
            return {
                isValid: false,
                reason: error.message
            };
        }
    }

    // Validate Bitcoin address
    validateAddress(address) {
        try {
            if (!address) {
                return {
                    isValid: false,
                    reason: 'Address is empty'
                };
            }

            // Check basic format
            if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(address)) {
                return {
                    isValid: false,
                    reason: 'Invalid characters in address'
                };
            }

            // Determine format
            let format = 'Unknown';
            if (address.startsWith('1')) format = 'Legacy (P2PKH)';
            else if (address.startsWith('3')) format = 'SegWit (P2SH)';
            else if (address.startsWith('bc1q')) format = 'Native SegWit (P2WPKH)';
            else if (address.startsWith('bc1p')) format = 'Taproot (P2TR)';
            
            return {
                isValid: true,
                format: format
            };
        } catch (error) {
            console.error('Error validating address:', error);
            return {
                isValid: false,
                reason: error.message
            };
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