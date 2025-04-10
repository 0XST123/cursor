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
            
            // Check compressed address
            console.log('Checking compressed address:', addresses.compressed.address);
            const compressedResult = await this.api.checkAddressDetails(addresses.compressed.address);
            console.log('Compressed address result:', compressedResult);
            this.addResultToTable(addresses.compressed.address, compressedResult);
            
            // Check uncompressed address
            console.log('Checking uncompressed address:', addresses.uncompressed.address);
            const uncompressedResult = await this.api.checkAddressDetails(addresses.uncompressed.address);
            console.log('Uncompressed address result:', uncompressedResult);
            this.addResultToTable(addresses.uncompressed.address, uncompressedResult);
            
        } catch (error) {
            console.error('Error checking phrase:', error);
            alert('Error checking phrase. Please try again.');
        }
    }

    addResultToTable(address, result) {
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
        console.log('Row added to table');
    }
}

// Initialize the custom phrase check module
document.addEventListener('DOMContentLoaded', () => {
    new CustomPhraseCheck();
}); 