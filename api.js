// API провайдеры
class BlockchairAPI {
    constructor() {
        this.API_KEY = 'A___XlvcUCcOjwiFTR2rRKASglriL77n';
        this.baseUrl = 'https://api.blockchair.com/bitcoin';
        this.requestsLeft = 0;
        this.requestsPerSecond = 0;
        this.lastRequestTime = Date.now();
    }

    async checkAddress(address) {
        try {
            // Добавляем минимальную задержку между запросами
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < 200) { // Минимум 200мс между запросами
                await new Promise(resolve => setTimeout(resolve, 200 - timeSinceLastRequest));
            }

            // Формируем URL для blockchain.info API
            const url = `${this.baseUrl}/dashboards/address/${address}`;
            const separator = url.includes('?') ? '&' : '?';
            const finalUrl = `${url}${separator}key=${this.API_KEY}`;

            console.log('Requesting Blockchair URL:', finalUrl);
            const response = await fetch(finalUrl);
            const data = await response.json();
            
            // Логируем ответ для отладки
            console.log('API Response:', JSON.stringify(data, null, 2));
            
            this.lastRequestTime = Date.now();

            if (data.context && typeof data.context.api_requests_left !== 'undefined') {
                this.requestsLeft = data.context.api_requests_left;
                this.requestsPerSecond = data.context.api_requests_per_second_limit;
            }

            if (data.data && data.data[address]) {
                const addressData = data.data[address];
                const balance = addressData.balance || 
                              (addressData.address && addressData.address.balance) || 
                              0;
                return Number(balance) / 100000000;
            }
            
            return 0;
        } catch (error) {
            console.error('Blockchair API error:', error);
            return 0;
        }
    }

    getRequestsLeft() {
        return this.requestsLeft;
    }

    getRequestsPerSecond() {
        return this.requestsPerSecond;
    }
}

class BlockchainInfoAPI {
    constructor() {
        this.baseUrl = 'https://blockchain.info';
        this.requestsLeft = 0;
        this.requestsPerSecond = 0;
        this.lastRequestTime = Date.now();
    }

    async checkAddress(address) {
        try {
            // Добавляем минимальную задержку между запросами
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < 200) { // Минимум 200мс между запросами
                await new Promise(resolve => setTimeout(resolve, 200 - timeSinceLastRequest));
            }

            // Формируем URL для blockchain.info API
            const finalUrl = `${this.baseUrl}/rawaddr/${address}`;

            console.log('Requesting Blockchain.info URL:', finalUrl);
            const response = await fetch(finalUrl);
            const data = await response.json();
            
            // Логируем ответ для отладки
            console.log('API Response:', JSON.stringify(data, null, 2));
            
            this.lastRequestTime = Date.now();

            // В этом API баланс уже в сатоши
            if (data && typeof data.final_balance !== 'undefined') {
                return Number(data.final_balance) / 100000000; // конвертация в BTC
            }
            
            return 0;
        } catch (error) {
            console.error('Blockchain.info API error:', error);
            return 0;
        }
    }

    getRequestsLeft() {
        return this.requestsLeft;
    }

    getRequestsPerSecond() {
        return this.requestsPerSecond;
    }
}

// Фабрика API
class BitcoinAPIFactory {
    static getAPI(provider = 'blockchain.info') {
        switch (provider.toLowerCase()) {
            case 'blockchair':
                return new BlockchairAPI();
            case 'blockchain.info':
                return new BlockchainInfoAPI();
            default:
                console.warn(`Unknown API provider: ${provider}, using blockchain.info as fallback`);
                return new BlockchainInfoAPI();
        }
    }
}

// Экспортируем фабрику для использования
export default BitcoinAPIFactory; 