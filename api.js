class BlockchairAPI {
    constructor() {
        this.API_KEY = 'AKPIXlvcUCcOjwiFTR2rRKASglriL77n';
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

            // Формируем URL с API ключом
            const url = `${this.baseUrl}/dashboards/address/${address}`;
            const separator = url.includes('?') ? '&' : '?';
            const finalUrl = `${url}${separator}key=${this.API_KEY}`;

            console.log('Requesting URL:', finalUrl);
            const response = await fetch(finalUrl);
            const data = await response.json();
            
            // Логируем ответ для отладки
            console.log('API Response:', JSON.stringify(data, null, 2));
            
            this.lastRequestTime = Date.now();
            
            if (data.context && typeof data.context.api_requests_left !== 'undefined') {
                this.requestsLeft = data.context.api_requests_left;
                this.requestsPerSecond = data.context.api_requests_per_second_limit;
            }

            // Проверяем наличие данных и получаем баланс
            if (data.data && data.data[address]) {
                const addressData = data.data[address];
                // Проверяем разные возможные пути к балансу
                const balance = addressData.balance || 
                              (addressData.address && addressData.address.balance) || 
                              0;
                
                return Number(balance) / 100000000; // конвертация в BTC
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