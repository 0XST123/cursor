// API провайдер для Blockchair
class BlockchairAPI {
    constructor() {
        this.apiKey = 'A___XlvcUCcOjwiFTR2rRKASglriL77n';
        this.baseUrl = 'https://api.blockchair.com/bitcoin';
        this.maxAddressesPerRequest = 5; // Уменьшаем размер пакета до 5
        this.requestLimit = 30;
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.minDelay = 2000; // Увеличиваем минимальную задержку
        this.errorCount = 0;
        this.maxErrors = 5;
        this.cache = new Map();
    }

    async checkAddressesBatch(addresses) {
        if (!Array.isArray(addresses) || addresses.length === 0) {
            throw new Error('Invalid addresses array');
        }

        console.log('Checking addresses:', addresses);
        const results = new Map();
        
        // Группируем адреса по 5 штук
        const batches = [];
        for (let i = 0; i < addresses.length; i += this.maxAddressesPerRequest) {
            batches.push(addresses.slice(i, i + this.maxAddressesPerRequest));
        }

        for (const batch of batches) {
            try {
                await this.waitForRateLimit();
                console.log('Rate limit check passed, proceeding with API call');
                
                // Используем правильный формат URL для Blockchair API
                const addressQueries = batch.map(addr => `address=${encodeURIComponent(addr)}`).join('&');
                const url = `${this.baseUrl}/dashboards/addresses?${addressQueries}&key=${this.apiKey}`;
                
                console.log('Making API request to:', url.replace(this.apiKey, '[REDACTED]'));
                console.log('Addresses in batch:', batch);
                
                const response = await fetch(url);
                console.log('API Response Status:', response.status);
                
                if (!response.ok) {
                    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('Raw API Response:', JSON.stringify(data, null, 2));
                
                if (data.error) {
                    throw new Error(data.error);
                }

                // Process each address in the batch
                for (const address of batch) {
                    try {
                        // Получаем данные адреса из правильного пути в ответе
                        const addressData = data.data?.[address];
                        
                        console.log(`Raw data for ${address}:`, addressData);
                        
                        if (!addressData) {
                            console.warn(`No data returned for address: ${address}`);
                            results.set(address, { error: 'No data returned from API' });
                            continue;
                        }

                        // Обрабатываем данные с учетом структуры ответа Blockchair
                        const result = {
                            balance: Number(addressData.address?.balance || 0) / 100000000,
                            hasTransactions: Number(addressData.address?.transaction_count || 0) > 0,
                            transactionCount: Number(addressData.address?.transaction_count || 0),
                            totalReceived: Number(addressData.address?.received || 0) / 100000000,
                            totalSent: Number(addressData.address?.spent || 0) / 100000000
                        };
                        
                        console.log(`Processed result for ${address}:`, result);
                        results.set(address, result);
                        this.cache.set(address, result);
                    } catch (addressError) {
                        console.error(`Error processing address ${address}:`, addressError);
                        results.set(address, { error: addressError.message });
                    }
                }
                
                this.errorCount = 0;
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error('Error in batch request:', error);
                this.errorCount++;
                
                if (this.errorCount >= this.maxErrors) {
                    console.log('Too many errors, taking a longer break...');
                    await new Promise(resolve => setTimeout(resolve, 30000));
                    this.errorCount = 0;
                }
                
                for (const address of batch) {
                    results.set(address, { error: error.message });
                }
            }
        }
        
        return addresses.map(addr => results.get(addr) || { error: 'Unknown error' });
    }

    validateAndProcessAddressData(data) {
        try {
            console.log('Validating data:', data);
            
            // Проверяем различные форматы данных
            const addressInfo = data.address || data;
            
            if (!addressInfo) {
                console.warn('No address info found in data');
                return {
                    balance: 0,
                    hasTransactions: false,
                    transactionCount: 0,
                    totalReceived: 0,
                    totalSent: 0
                };
            }

            // Извлекаем значения, проверяя различные пути к данным
            const balance = Number(addressInfo.balance || addressInfo.final_balance || 0);
            const txCount = Number(addressInfo.transaction_count || addressInfo.n_tx || 0);
            const received = Number(addressInfo.received || addressInfo.total_received || 0);
            const spent = Number(addressInfo.spent || addressInfo.total_sent || 0);

            console.log('Extracted values:', { balance, txCount, received, spent });

            return {
                balance: balance / 100000000,
                hasTransactions: txCount > 0,
                transactionCount: txCount,
                totalReceived: received / 100000000,
                totalSent: spent / 100000000
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