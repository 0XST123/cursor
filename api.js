// API провайдер для Blockchair
class BlockchairAPI {
    constructor() {
        this.apiKey = 'A___XlvcUCcOjwiFTR2rRKASglriL77n';
        this.baseUrl = 'https://api.blockchair.com';
        this.requestLimit = 30;
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.minDelay = 2000;
        this.errorCount = 0;
        this.maxErrors = 5;
        this.cache = new Map();
    }

    async checkAddress(address) {
        try {
            await this.waitForRateLimit();
            console.log('Rate limit check passed, proceeding with API call');
            
            const url = new URL(`${this.baseUrl}/bitcoin/dashboards/address/${address}`);
            url.searchParams.append('key', this.apiKey);
            
            console.log('Making API request to:', url.toString().replace(this.apiKey, '[REDACTED]'));
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            console.log('API Response Status:', response.status);
            
            if (response.status === 430 || response.status === 403) {
                throw new Error('API access denied. Please check your API key and permissions.');
            }
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Raw API Response:', JSON.stringify(data, null, 2));
            
            if (data.error) {
                throw new Error(data.error);
            }

            const addressData = data.data?.[address] || data.data;
            console.log(`Raw data for ${address}:`, addressData);
            
            if (!addressData) {
                console.warn(`No data returned for address: ${address}`);
                return { error: 'No data returned from API' };
            }

            const result = {
                balance: Number(addressData.address?.balance || 0) / 100000000,
                hasTransactions: Number(addressData.address?.transaction_count || 0) > 0,
                transactionCount: Number(addressData.address?.transaction_count || 0),
                totalReceived: Number(addressData.address?.received || 0) / 100000000,
                totalSent: Number(addressData.address?.spent || 0) / 100000000
            };
            
            console.log(`Processed result for ${address}:`, result);
            this.cache.set(address, result);
            return result;
            
        } catch (error) {
            console.error(`Error checking address ${address}:`, error);
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

    async checkAddressesBatch(addresses) {
        const results = [];
        for (const address of addresses) {
            const result = await this.checkAddress(address);
            results.push(result);
            // Добавляем небольшую задержку между запросами
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return results;
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