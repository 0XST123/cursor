async function testBatchProcessing() {
    const api = new BlockchairAPI();
    
    // Тестовые адреса разных типов:
    const addresses = [
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',  // Genesis block (valuable)
        '12BMWCjzQkHiYmNSXwMEBQPcXpGy8iuDFX',  // Used address with 0 balance
        '1CounterpartyXXXXXXXXXXXXXXXUWLpVr',  // Active address
        '1BitcoinEaterAddressDontSendf59kuE',  // Unused address
        '1A8JiWcwvpY7tAopUkSnGuEYHmzGYfZPiq',  // Random address
    ];
    
    console.log('Testing batch processing...');
    console.log('Addresses to check:', addresses.length);
    
    try {
        console.log('\nSending batch request...');
        const results = await api.checkAddressesBatch(addresses);
        
        console.log('\nResults:');
        for (const [address, data] of Object.entries(results)) {
            console.log(`\nAddress: ${address}`);
            console.log('Balance:', data.balance);
            console.log('Total Received:', data.totalReceived);
            console.log('Total Sent:', data.totalSent);
            console.log('Has Transactions:', data.hasTransactions);
        }
        
    } catch (error) {
        console.error('Error during batch test:', error);
    }
}

// Run the test
console.log('Starting batch processing test...');
testBatchProcessing(); 