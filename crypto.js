// Templates and components for phrase generation
const templates = [
    "{adjective} {noun} {year}",
    "{verb} {noun} {number}",
    "{noun} {verb} {year}",
    "{adjective} {verb} {number}"
];

const components = {
    adjective: ["happy", "lucky", "golden", "silver", "crypto", "digital", "virtual", "secret"],
    noun: ["bitcoin", "wallet", "key", "block", "chain", "crypto", "coin", "satoshi"],
    verb: ["mining", "holding", "trading", "staking", "buying", "selling"],
    year: ["2009", "2010", "2011", "2012", "2013", "2014", "2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023"],
    number: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"]
};

class PhraseGenerator {
    constructor() {
        this.templates = templates;
        this.components = components;
    }

    generatePhrase() {
        const template = this.templates[Math.floor(Math.random() * this.templates.length)];
        return template.replace(/{(\w+)}/g, (match, component) => {
            const options = this.components[component];
            return options[Math.floor(Math.random() * options.length)];
        });
    }

    generatePhrases(count) {
        const phrases = [];
        for (let i = 0; i < count; i++) {
            phrases.push(this.generatePhrase());
        }
        return phrases;
    }
}

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

            // Initialize elliptic curve
            this.ec = new elliptic.ec('secp256k1');
            
            // Log successful initialization
            console.log('Required libraries loaded:', {
                elliptic: typeof elliptic,
                CryptoJS: typeof CryptoJS
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

    // Original method for compressed public keys
    generatePublicKey(privateKeyHex) {
        try {
            console.log('Generating compressed public key...');
            if (!privateKeyHex) {
                throw new Error('Пустой приватный ключ');
            }
            
            // Create key pair from private key
            const keyPair = this.ec.keyFromPrivate(privateKeyHex, 'hex');
            // Get public key in compressed format
            const publicKey = keyPair.getPublic(true, 'hex');
            
            console.log('Compressed public key generated successfully');
            return publicKey;
        } catch (error) {
            console.error('Error generating compressed public key:', error);
            throw new Error(`Ошибка генерации сжатого публичного ключа: ${error.message}`);
        }
    }

    // New method for uncompressed public keys
    generateUncompressedPublicKey(privateKeyHex) {
        try {
            console.log('Generating uncompressed public key...');
            if (!privateKeyHex) {
                throw new Error('Пустой приватный ключ');
            }
            
            // Create key pair from private key
            const keyPair = this.ec.keyFromPrivate(privateKeyHex, 'hex');
            // Get public key in uncompressed format
            const publicKey = keyPair.getPublic(false, 'hex');
            
            // Ensure the public key starts with '04'
            const formattedPublicKey = publicKey.startsWith('04') ? publicKey : '04' + publicKey;
            
            console.log('Uncompressed public key generated successfully');
            return formattedPublicKey;
        } catch (error) {
            console.error('Error generating uncompressed public key:', error);
            throw new Error(`Ошибка генерации несжатого публичного ключа: ${error.message}`);
        }
    }

    // Original method for generating address (compressed)
    generateAddress(publicKeyHex) {
        try {
            console.log('Generating Bitcoin address from compressed public key...');
            if (!publicKeyHex) {
                throw new Error('Пустой публичный ключ');
            }
            
            // Convert hex string to WordArray
            const publicKeyWordArray = CryptoJS.enc.Hex.parse(publicKeyHex);
            
            // Step 1: SHA-256 of public key
            const sha256 = CryptoJS.SHA256(publicKeyWordArray);
            
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
            
            // Step 7: Convert hex to bytes and then to base58
            const bytes = this.hexToBytes(binaryAddress);
            const address = this.base58Encode(bytes);
            
            // Validate generated address
            const validation = this.validateAddress(address);
            if (!validation.isValid) {
                throw new Error(`Invalid address generated: ${validation.reason}`);
            }
            
            console.log('Bitcoin address generated successfully from compressed key');
            return address;
        } catch (error) {
            console.error('Error generating address:', error);
            throw new Error(`Ошибка генерации адреса: ${error.message}`);
        }
    }

    // New method for generating address from uncompressed public key
    generateUncompressedAddress(publicKeyHex) {
        try {
            console.log('Generating Bitcoin address from uncompressed public key...');
            if (!publicKeyHex) {
                throw new Error('Пустой публичный ключ');
            }
            
            // Ensure the public key is in uncompressed format
            if (!publicKeyHex.startsWith('04')) {
                throw new Error('Invalid uncompressed public key format');
            }
            
            // Convert hex string to WordArray
            const publicKeyWordArray = CryptoJS.enc.Hex.parse(publicKeyHex);
            
            // Step 1: SHA-256 of public key
            const sha256 = CryptoJS.SHA256(publicKeyWordArray);
            
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
            
            // Step 7: Convert hex to bytes and then to base58
            const bytes = this.hexToBytes(binaryAddress);
            const address = this.base58Encode(bytes);
            
            // Validate generated address
            const validation = this.validateAddress(address);
            if (!validation.isValid) {
                throw new Error(`Invalid address generated: ${validation.reason}`);
            }
            
            console.log('Bitcoin address generated successfully from uncompressed key');
            return address;
        } catch (error) {
            console.error('Error generating address:', error);
            throw new Error(`Ошибка генерации адреса: ${error.message}`);
        }
    }

    // Generate both compressed and uncompressed addresses
    generateBothAddresses(privateKeyHex) {
        try {
            const compressedPubKey = this.generatePublicKey(privateKeyHex);
            const uncompressedPubKey = this.generateUncompressedPublicKey(privateKeyHex);
            
            return {
                compressed: {
                    publicKey: compressedPubKey,
                    address: this.generateAddress(compressedPubKey)
                },
                uncompressed: {
                    publicKey: uncompressedPubKey,
                    address: this.generateUncompressedAddress(uncompressedPubKey)
                }
            };
        } catch (error) {
            console.error('Error generating both addresses:', error);
            throw error;
        }
    }

    // Generate wallet with both compressed and uncompressed addresses
    generateWallet(phrase) {
        try {
            const privateKey = this.generatePrivateKey(phrase);
            const addresses = this.generateBothAddresses(privateKey);
            
            return {
                phrase,
                privateKey,
                compressed: addresses.compressed,
                uncompressed: addresses.uncompressed
            };
        } catch (error) {
            console.error('Error generating wallet:', error);
            throw error;
        }
    }

    // Convert hex string to byte array
    hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    // Base58 encoding
    base58Encode(bytes) {
        const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        
        // Convert bytes to big number
        let num = 0n;
        for (let i = 0; i < bytes.length; i++) {
            num = num * 256n + BigInt(bytes[i]);
        }
        
        // Convert big number to base58
        let result = '';
        while (num > 0n) {
            const mod = Number(num % 58n);
            result = ALPHABET[mod] + result;
            num = num / 58n;
        }
        
        // Add leading zeros
        for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
            result = '1' + result;
        }
        
        return result;
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
} 