class CustomPhraseCheck {
    constructor() {
        this.api = new BlockchairAPI();
        this.wallet = new BitcoinWallet();
        this.phraseInput = document.getElementById('phraseInput');
        this.checkButton = document.getElementById('checkPhraseBtn');
        this.resultsBody = document.getElementById('phraseResultsBody');
        this.phraseKeyHeader = document.getElementById('phraseKeyHeader');
        
        this.checkButton.addEventListener('click', () => this.checkPhrase());
    }

    async checkPhrase() {
        const phrase = this.phraseInput.value.trim();
        if (!phrase) {
            alert('Please enter a phrase');
            return;
        }

        try {
            // Generate private key from phrase
            const privateKey = this.wallet.generatePrivateKey(phrase);
            
            // Generate addresses from private key
            const addresses = this.wallet.generateBothAddresses(privateKey);
            
            // Update header with phrase and private key
            this.phraseKeyHeader.textContent = `Phrase: ${phrase} | Private Key: ${privateKey}`;
            
            // Clear previous results
            this.resultsBody.innerHTML = '';
            
            // Check compressed address
            if (addresses.compressed) {
                const compressedResult = await this.api.checkAddressDetails(addresses.compressed.address);
                this.addResultToTable(addresses.compressed.address, compressedResult, 'Compressed');
            }
            
            // Check uncompressed address
            if (addresses.uncompressed) {
                const uncompressedResult = await this.api.checkAddressDetails(addresses.uncompressed.address);
                this.addResultToTable(addresses.uncompressed.address, uncompressedResult, 'Uncompressed');
            }
        } catch (error) {
            console.error('Error checking phrase:', error);
            alert('Error checking phrase. Please try again.');
        }
    }

    addResultToTable(address, result, type) {
        if (result.balance > 0 || result.transactionCount > 0) {
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
        }
    }
}

// Initialize the custom phrase check module
document.addEventListener('DOMContentLoaded', () => {
    new CustomPhraseCheck();
}); 