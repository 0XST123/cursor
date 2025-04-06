class BlockchairAPI {
    constructor() {
        this.baseUrl = 'https://api.blockchair.com/bitcoin';
        this.requestsLeft = 0;
        this.requestsPerSecond = 0;
    }

    async checkAddress(address) {
        try {
            console.log('Requesting URL:', `${this.baseUrl}/dashboards/address/${address}`);
            const response = await fetch(`${this.baseUrl}/dashboards/address/${address}`);
            const data = await response.json();
            
            if (data.context && typeof data.context.api_requests_left !== 'undefined') {
                this.requestsLeft = data.context.api_requests_left;
                this.requestsPerSecond = data.context.api_requests_per_second_limit;
            }

            // Проверяем структуру ответа и преобразуем баланс в число
            if (data.data && data.data[address] && typeof data.data[address].address.balance !== 'undefined') {
                // Конвертируем баланс из сатоши в BTC (1 BTC = 100,000,000 сатоши)
                return Number(data.data[address].address.balance) / 100000000;
            }
            
            return 0;
        } catch (error) {
            console.error('API request error:', error);
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