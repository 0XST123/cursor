class CustomPhraseCheck {
    constructor() {
        this.api = new BlockchairAPI();
        this.wallet = new BitcoinWallet();
        this.phraseInput = document.getElementById('phraseInput');
        this.checkButton = document.getElementById('checkPhraseBtn');
        this.resultsBody = document.getElementById('phraseResultsBody');
        this.phraseKeyHeader = document.getElementById('phraseKeyHeader');
        this.displayedAddresses = new Set();
        
        this.checkButton.addEventListener('click', () => this.checkPhrase());
    }

    async checkPhrase() {
        const phrase = this.phraseInput.value.trim();
        if (!phrase) {
            alert('Please enter a phrase');
            return;
        }

        try {
            console.log('Checking phrase:', phrase);
            
            // Generate private key from phrase
            const privateKey = this.wallet.generatePrivateKey(phrase);
            console.log('Generated private key:', privateKey);
            
            // Generate both addresses from private key
            const addresses = this.wallet.generateBothAddresses(privateKey);
            console.log('Generated addresses:', addresses);
            
            // Update header with phrase and private key
            this.phraseKeyHeader.textContent = `Phrase: ${phrase} | Private Key: ${privateKey}`;
            
            // Clear previous results
            this.resultsBody.innerHTML = '';
            this.displayedAddresses.clear();
            
            // Check both addresses
            const [compressedResult, uncompressedResult] = await Promise.all([
                this.checkAddressIfNotDisplayed(addresses.compressed.address),
                this.checkAddressIfNotDisplayed(addresses.uncompressed.address)
            ]);
            
            // Add results to table only if they haven't been displayed yet
            if (compressedResult) {
                this.addResultToTable(addresses.compressed.address, compressedResult);
            }
            if (uncompressedResult) {
                this.addResultToTable(addresses.uncompressed.address, uncompressedResult);
            }
            
        } catch (error) {
            console.error('Error checking phrase:', error);
            alert('Error checking phrase. Please try again.');
        }
    }

    async checkAddressIfNotDisplayed(address) {
        if (this.displayedAddresses.has(address)) {
            console.log('Address already displayed, skipping check:', address);
            return null;
        }
        return await this.api.checkAddressDetails(address);
    }

    addResultToTable(address, result) {
        if (!result || this.displayedAddresses.has(address)) {
            return;
        }
        
        console.log('Adding result to table:', { address, result });
        
        const row = document.createElement('tr');
        
        // Determine status
        let status = 'Empty';
        let statusClass = 'status-empty';
        if (result.balance > 0) {
            status = 'Valuable';
            statusClass = 'status-valuable';
        } else if (result.transactionCount > 0) {
            status = 'Used';
            statusClass = 'status-used';
        }
        
        row.innerHTML = `
            <td class="address-cell">${address}</td>
            <td class="balance-cell">${result.balance} BTC</td>
            <td>${result.transactionCount}</td>
            <td class="balance-cell">${result.totalReceived} BTC</td>
            <td class="balance-cell">${result.totalSent} BTC</td>
            <td class="${statusClass}">${status}</td>
        `;
        
        this.resultsBody.appendChild(row);
        this.displayedAddresses.add(address);
        console.log('Row added to table');
    }
}

// Initialize the custom phrase check module only if not already initialized
if (!window.customPhraseCheck) {
    document.addEventListener('DOMContentLoaded', () => {
        window.customPhraseCheck = new CustomPhraseCheck();
    });
} 