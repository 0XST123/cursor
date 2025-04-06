class BitcoinWallet {
    constructor() {
        try {
            console.log('Initializing BitcoinWallet...');
            if (typeof bitcoin === 'undefined') {
                throw new Error('bitcoinjs-lib not loaded');
            }
            // Use mainnet network
            this.network = bitcoin.networks.bitcoin;
            console.log('BitcoinWallet initialized successfully');
        } catch (error) {
            console.error('Failed to initialize BitcoinWallet:', error);
            throw error;
        }
    }

    // Generate private key from phrase using SHA-256
    generatePrivateKey(phrase) {
        try {
            // Generate SHA256 hash of the phrase
            const hash = bitcoin.crypto.sha256(Buffer.from(phrase));
            return hash.toString('hex');
        } catch (error) {
            console.error('Error generating private key:', error);
            throw error;
        }
    }

    // Generate public key from private key
    generatePublicKey(privateKeyHex) {
        try {
            // Convert hex to Buffer
            const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
            // Create ECPair from private key
            const keyPair = bitcoin.ECPair.fromPrivateKey(privateKeyBuffer);
            // Get public key
            return keyPair.publicKey.toString('hex');
        } catch (error) {
            console.error('Error generating public key:', error);
            throw error;
        }
    }

    // Generate Bitcoin address from public key
    generateAddress(publicKeyHex) {
        try {
            // Convert hex to Buffer
            const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');
            
            // Create P2PKH (Legacy) address
            const { address } = bitcoin.payments.p2pkh({
                pubkey: publicKeyBuffer,
                network: this.network
            });
            
            // Ensure the address starts with '1' for Legacy addresses
            if (address && !address.startsWith('1')) {
                return '1' + address;
            }
            
            return address;
        } catch (error) {
            console.error('Error generating address:', error);
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

            const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');

            try {
                // Try to create key pair
                const keyPair = bitcoin.ECPair.fromPrivateKey(privateKeyBuffer);
                return {
                    isValid: true,
                    publicKey: keyPair.publicKey.toString('hex')
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

            try {
                bitcoin.address.toOutputScript(address, this.network);
                let format = 'Unknown';
                
                if (address.startsWith('1')) format = 'Legacy (P2PKH)';
                else if (address.startsWith('3')) format = 'SegWit (P2SH)';
                else if (address.startsWith('bc1q')) format = 'Native SegWit (P2WPKH)';
                else if (address.startsWith('bc1p')) format = 'Taproot (P2TR)';
                
                return {
                    isValid: true,
                    format: format
                };
            } catch (e) {
                return {
                    isValid: false,
                    reason: 'Invalid address format or checksum'
                };
            }
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