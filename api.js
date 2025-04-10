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

    async checkAddressesBalances(addresses) {
        try {
            if (!Array.isArray(addresses) || addresses.length === 0) {
                throw new Error('Invalid addresses array');
            }

            if (addresses.length > 100) {
                throw new Error('Maximum 100 addresses per request allowed');
            }

            await this.waitForRateLimit();
            console.log('Rate limit check passed, proceeding with batch balance check');
            
            const addressesStr = addresses.join(',');
            const url = new URL(`${this.baseUrl}/bitcoin/addresses/balances`);
            url.searchParams.append('addresses', addressesStr);
            url.searchParams.append('key', this.apiKey);
            
            console.log(`Making batch balance check for ${addresses.length} addresses`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            console.log('API Response Status:', response.status);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Преобразуем ответ в формат { address: balance }
            const results = {};
            for (const address of addresses) {
                const balance = Number(data.data?.[address]?.balance || 0);
                results[address] = {
                    balance: balance / 100000000,
                    hasBalance: balance > 0
                };
            }
            
            return results;
            
        } catch (error) {
            console.error('Error in batch balance check:', error);
            throw error;
        }
    }

    async checkAddressDetails(address) {
        try {
            await this.waitForRateLimit();
            console.log('Rate limit check passed, proceeding with detailed address check');
            
            const url = new URL(`${this.baseUrl}/bitcoin/dashboards/address/${address}`);
            url.searchParams.append('key', this.apiKey);
            
            console.log('Making detailed address check request');
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            console.log('API Response Status:', response.status);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            const addressData = data.data[address];
            console.log('Raw API response:', JSON.stringify(data, null, 2));
            console.log(`Raw data for ${address}:`, addressData);
            
            if (!addressData) {
                throw new Error('No data returned from API');
            }

            const result = {
                balance: Number(addressData.address.balance || 0) / 100000000,
                hasTransactions: Number(addressData.address.transaction_count || 0) > 0,
                transactionCount: Number(addressData.address.transaction_count || 0),
                totalReceived: Number(addressData.address.received || 0) / 100000000,
                totalSent: Number(addressData.address.spent || 0) / 100000000
            };
            
            console.log(`Processed result for ${address}:`, result);
            this.cache.set(address, result);
            return result;
            
        } catch (error) {
            console.error(`Error checking address details ${address}:`, error);
            return {
                error: error.message,
                balance: 0,
                hasTransactions: false,
                transactionCount: 0,
                totalReceived: 0,
                totalSent: 0
            };
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
            console.log('Rate limit reached, waiting 60 seconds...');
            await new Promise(resolve => setTimeout(resolve, 60000));
            this.requestCount = 0;
            console.log('Continuing after rate limit wait');
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