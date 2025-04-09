// API провайдер для Blockchair
class BlockchairAPI {
    constructor() {
        this.apiKey = 'A___XlvcUCcOjwiFTR2rRKASglriL77n';
        this.baseUrl = 'https://api.blockchair.com/bitcoin';
        this.maxAddressesPerRequest = 100; // Максимальное количество адресов за запрос
        this.requestLimit = 30;
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.minDelay = 1000;
        this.errorCount = 0;
        this.maxErrors = 5;
        this.cache = new Map();
    }

    async checkAddressesBatch(addresses) {
        if (!Array.isArray(addresses) || addresses.length === 0) {
            throw new Error('Invalid addresses array');
        }

        // Проверяем кэш
        const uncachedAddresses = addresses.filter(addr => !this.cache.has(addr));
        if (uncachedAddresses.length === 0) {
            return addresses.map(addr => this.cache.get(addr));
        }

        // Группируем адреса по 100 штук
        const batches = [];
        for (let i = 0; i < uncachedAddresses.length; i += this.maxAddressesPerRequest) {
            batches.push(uncachedAddresses.slice(i, i + this.maxAddressesPerRequest));
        }

        const results = new Map();
        
        for (const batch of batches) {
            try {
                await this.waitForRateLimit();
                console.log('Rate limit check passed, proceeding with API call');
                
                // Format URL in v1.4 style for multiple addresses
                const url = `${this.baseUrl}/addresses`;
                const params = new URLSearchParams();
                
                // Add addresses one by one to handle special characters correctly
                batch.forEach(address => {
                    params.append('addresses[]', address);
                });
                
                // Add other parameters
                params.append('key', this.apiKey);
                
                const finalUrl = `${url}?${params.toString()}`;
                
                console.log('Making API request to:', finalUrl.replace(this.apiKey, '[REDACTED]'));
                console.log('Addresses in batch:', batch);
                
                const response = await fetch(finalUrl);
                console.log('API Response Status:', response.status);
                
                if (!response.ok) {
                    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('Raw API Response:', data);
                
                if (data.error) {
                    throw new Error(data.error);
                }

                // Process each address in the batch
                for (const address of batch) {
                    const addressData = data.data?.[address];
                    
                    if (!addressData || !addressData.address) {
                        console.warn(`No data returned for address: ${address}`);
                        const emptyResult = {
                            balance: 0,
                            hasTransactions: false,
                            transactionCount: 0,
                            totalReceived: 0,
                            totalSent: 0
                        };
                        results.set(address, emptyResult);
                        continue;
                    }

                    const result = {
                        balance: Number(addressData.address.balance || 0) / 100000000,
                        hasTransactions: Number(addressData.address.transaction_count || 0) > 0,
                        transactionCount: Number(addressData.address.transaction_count || 0),
                        totalReceived: Number(addressData.address.received || 0) / 100000000,
                        totalSent: Number(addressData.address.spent || 0) / 100000000
                    };
                    
                    console.log(`Processed result for ${address}:`, result);
                    results.set(address, result);
                    this.cache.set(address, result);
                }
                
                this.errorCount = 0;
            } catch (error) {
                console.error('Error in batch request:', error);
                this.errorCount++;
                
                // Если слишком много ошибок, делаем длительную паузу
                if (this.errorCount >= this.maxErrors) {
                    await new Promise(resolve => setTimeout(resolve, 30000));
                    this.errorCount = 0;
                }
                
                // Помечаем все адреса в батче как ошибочные
                for (const address of batch) {
                    results.set(address, { error: error.message });
                }
            }
        }
        
        // Возвращаем результаты для всех запрошенных адресов
        return addresses.map(addr => results.get(addr) || { error: 'Unknown error' });
    }

    validateAndProcessAddressData(data) {
        try {
            if (!data || !data.address) {
                return {
                    balance: 0,
                    hasTransactions: false,
                    transactionCount: 0,
                    totalReceived: 0,
                    totalSent: 0
                };
            }

            return {
                balance: data.address.balance / 100000000,
                hasTransactions: data.address.transaction_count > 0,
                transactionCount: data.address.transaction_count,
                totalReceived: data.address.received / 100000000,
                totalSent: data.address.spent / 100000000
            };
        } catch (error) {
            console.error('Data validation error:', error);
            return { error: error.message };
        }
    }

    async waitForRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minDelay) {
            await new Promise(resolve => setTimeout(resolve, this.minDelay - timeSinceLastRequest));
        }
        
        this.lastRequestTime = Date.now();
        this.requestCount++;
        
        if (this.requestCount >= this.requestLimit) {
            await new Promise(resolve => setTimeout(resolve, 60000));
            this.requestCount = 0;
        }
    }

    async checkAddress(address, retryCount = 0) {
        const results = await this.checkAddressesBatch([address], retryCount);
        return results[address];
    }
}

// Фабрика API
class BitcoinAPIFactory {
    static createAPI() {
        return new BlockchairAPI();
    }
}

// Делаем классы доступными глобально
window.BlockchairAPI = BlockchairAPI;
window.BitcoinAPIFactory = BitcoinAPIFactory; 