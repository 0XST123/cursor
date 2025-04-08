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
                
                // Формируем правильный URL для API
                const queryParams = new URLSearchParams({
                    addresses: batch.join(','),
                    key: this.apiKey
                });
                
                const response = await fetch(`${this.baseUrl}/addresses?${queryParams}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // Валидация и обработка данных
                for (const address of batch) {
                    const addressData = data.data[address];
                    if (!addressData) {
                        results.set(address, { error: 'Address data not found' });
                        continue;
                    }
                    
                    const result = this.validateAndProcessAddressData(addressData);
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
            // Проверяем обязательные поля
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid data format');
            }

            // Валидация баланса
            const balance = parseFloat(data.balance || 0);
            if (isNaN(balance)) {
                throw new Error('Invalid balance value');
            }

            // Валидация транзакций
            const transactionCount = parseInt(data.transaction_count || 0);
            if (isNaN(transactionCount)) {
                throw new Error('Invalid transaction count');
            }

            // Валидация сумм
            const totalReceived = parseFloat(data.total_received || 0);
            const totalSent = parseFloat(data.total_sent || 0);
            
            if (isNaN(totalReceived) || isNaN(totalSent)) {
                throw new Error('Invalid transaction amounts');
            }

            return {
                balance,
                transactionCount,
                hasTransactions: transactionCount > 0,
                totalReceived,
                totalSent,
                lastActivity: data.last_activity || null
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