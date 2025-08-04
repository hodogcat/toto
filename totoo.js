const initialBalance = 100000; // 초기 자산 10만원
let balance;
let stocks = {};
let transactionHistory = []; // 거래 내역 배열

const stockNames = ['Stock Lab', 'Portfolio Institute', 'Quant Simulation', 'Virtual Market Place', 'Master Trader Academy', 'Investment Trade Dex'];
const updateInterval = 30 * 1000; // 30초 (변동 시간)
let timeLeft = updateInterval / 1000; // 남은 시간 (초 단위)
let countdownInterval; // 카운트다운 인터벌 ID

const currentBalanceEl = document.getElementById('current-balance');
const portfolioValueEl = document.getElementById('portfolio-value');
const stockListEl = document.getElementById('stock-list');
const transactionListEl = document.getElementById('transaction-list');
const messageArea = document.getElementById('message-area');
const timeToNextFluctuationEl = document.getElementById('time-to-next-fluctuation'); // 남은 시간 표시 요소

// Modal elements
const stockModal = document.getElementById('stockModal');
const closeButton = document.getElementsByClassName('close-button')[0];
const modalStockName = document.getElementById('modal-stock-name');
const modalCurrentPrice = document.getElementById('modal-current-price');
const modalPriceChange = document.getElementById('modal-price-change');
const modalOwnedQuantity = document.getElementById('modal-owned-quantity');
const modalTotalValue = document.getElementById('modal-total-value');
// const modalStockGraph = document.getElementById('modal-stock-graph'); // 기존 이미지 요소는 이제 사용하지 않습니다.

let currentChart = null; // Chart.js 차트 인스턴스를 저장할 변수

// 데이터 로드 또는 초기화
function loadData() {
    const savedBalance = localStorage.getItem('stockSimBalance');
    const savedStocks = localStorage.getItem('stockSimStocks');
    const savedTransactions = localStorage.getItem('stockSimTransactions');

    if (savedBalance && savedStocks && savedTransactions) {
        balance = parseFloat(savedBalance);
        stocks = JSON.parse(savedStocks);
        transactionHistory = JSON.parse(savedTransactions);
        // stocks 객체에 lastPrice와 priceHistory가 없을 경우 추가 (이전 버전에서 저장된 데이터 호환성)
        for (const name in stocks) {
            if (stocks[name].lastPrice === undefined) {
                stocks[name].lastPrice = stocks[name].price;
            }
            if (stocks[name].priceHistory === undefined) { // priceHistory가 없으면 초기화
                stocks[name].priceHistory = [stocks[name].price];
            }
        }
    } else {
        resetData(false); // 데이터가 없으면 초기화 (저장하지 않음)
    }
}

// 데이터 저장
function saveData() {
    localStorage.setItem('stockSimBalance', balance);
    localStorage.setItem('stockSimStocks', JSON.stringify(stocks));
    localStorage.setItem('stockSimTransactions', JSON.stringify(transactionHistory));
}

// 데이터 초기화
function resetData(save = true) {
    balance = initialBalance;
    stocks = {};
    stockNames.forEach(name => {
        const initialPrice = Math.floor(Math.random() * 5000) + 10000; // 10000 ~ 14999원 사이 초기 가격
        stocks[name] = {
            price: initialPrice,
            quantity: 0,
            lastPrice: 0, // 이전 가격 추적용
            priceHistory: [initialPrice] // 가격 기록 시작
        };
    });
    transactionHistory = [];
    if (save) {
        saveData();
        showMessage('모든 데이터가 초기화되었습니다.', 'info');
    }
    updateUI();
    resetCountdown(); // 데이터 초기화 시 타이머도 초기화
}

// UI 업데이트 함수
function updateUI() {
    currentBalanceEl.textContent = balance.toLocaleString();
    let totalPortfolioValue = 0;

    stockListEl.innerHTML = ''; // 기존 목록 초기화
    for (const name in stocks) {
        const stock = stocks[name];
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('stock-item');
        itemDiv.setAttribute('data-stock-name', name); // 팝업을 위해 주식 이름 저장

        let priceChange = stock.price - stock.lastPrice;
        let changeClass = '';
        let changeIndicator = '';

        if (stock.lastPrice !== 0 && stock.lastPrice !== undefined) { // 첫 업데이트 시에는 변동 표시 안 함
            if (priceChange > 0) {
                changeClass = 'positive';
                changeIndicator = ` (+${priceChange.toLocaleString()})`;
            } else if (priceChange < 0) {
                changeClass = 'negative';
                changeIndicator = ` (${priceChange.toLocaleString()})`;
            }
        }

        itemDiv.innerHTML = `
            <h2>${name}</h2>
            <p>현재가: <span class="price">${stock.price.toLocaleString()}원</span> <span class="change ${changeClass}">${changeIndicator}</span></p>
            <p>보유 수량: <span id="quantity-${name}">${stock.quantity}</span>주</p>
            <div class="controls">
                <input type="number" id="amount-${name}" value="1" min="1">
                <button class="buy" onclick="buyStock(event, '${name}')">매수</button>
                <button class="sell" onclick="sellStock(event, '${name}')">매도</button>
            </div>
        `;
        stockListEl.appendChild(itemDiv);

        totalPortfolioValue += stock.price * stock.quantity;

        // 클릭 이벤트 리스너 추가 (매수/매도 버튼 클릭은 제외)
        itemDiv.addEventListener('click', function(event) {
            // 클릭된 요소가 버튼이 아니면 팝업 표시
            if (!event.target.closest('button') && !event.target.closest('input')) {
                showStockModal(name);
            }
        });
    }
    portfolioValueEl.textContent = totalPortfolioValue.toLocaleString();

    // 남은 시간 표시 업데이트
    timeToNextFluctuationEl.textContent = timeLeft;

    // 거래 내역 업데이트
    transactionListEl.innerHTML = '';
    transactionHistory.forEach(transaction => {
        const listItem = document.createElement('li');
        listItem.classList.add(`${transaction.type}-entry`);
        listItem.innerHTML = `
            <span>[${transaction.timestamp}] ${transaction.name} ${transaction.type === 'buy' ? '매수' : '매도'}</span>
            <span>${transaction.quantity}주 @ ${transaction.price.toLocaleString()}원</span>
            <span>총 ${ (transaction.quantity * transaction.price).toLocaleString() }원</span>
        `;
        transactionListEl.prepend(listItem); // 최신 내역이 위로 오도록
    });
}

// 주식 가격 변동 함수
function fluctuatePrices() {
    for (const name in stocks) {
        const stock = stocks[name];
        stock.lastPrice = stock.price; // 현재 가격을 이전 가격으로 저장

        const change = (Math.random() * 2000 - 1000); // -1000원에서 +1000원 사이 변동
        let newPrice = stock.price + change;

        // 가격이 100원 이하로 떨어지지 않도록 보정
        if (newPrice < 100) {
            newPrice = 100;
        }
        stock.price = Math.floor(newPrice);
        
        // 가격 변동 기록 (최대 20개까지만 저장하여 메모리 관리)
        stock.priceHistory.push(stock.price);
        if (stock.priceHistory.length > 20) {
            stock.priceHistory.shift(); // 가장 오래된 데이터 제거
        }
    }
    updateUI();
    saveData(); // 가격 변동 후 데이터 저장
    
    // 가격 변동 후 타이머 초기화
    resetCountdown();
}

// 메시지 표시 함수
function showMessage(msg, type = 'info') {
    messageArea.textContent = msg;
    messageArea.style.display = 'block';
    if (type === 'error') {
        messageArea.style.backgroundColor = '#f44336';
        messageArea.style.color = 'white';
    } else if (type === 'success') {
        messageArea.style.backgroundColor = '#4CAF50';
        messageArea.style.color = 'white';
    } else {
        messageArea.style.backgroundColor = '#ffeb3b';
        messageArea.style.color = '#333';
    }

    setTimeout(() => {
        messageArea.style.display = 'none';
    }, 3000);
}

// 거래 내역 추가 함수
function addTransaction(type, name, quantity, price) {
    const timestamp = new Date().toLocaleString();
    transactionHistory.push({ type, name, quantity, price, timestamp });
    saveData(); // 거래 내역 추가 후 데이터 저장
}

// 주식 매수 함수
function buyStock(event, name) {
    event.stopPropagation(); // 부모 요소 클릭 이벤트 방지 (팝업 방지)
    const amountInput = document.getElementById(`amount-${name}`);
    const quantityToBuy = parseInt(amountInput.value);

    if (isNaN(quantityToBuy) || quantityToBuy <= 0) {
        showMessage('유효한 수량을 입력해주세요.', 'error');
        return;
    }

    const stock = stocks[name];
    const cost = stock.price * quantityToBuy;

    if (balance >= cost) {
        balance -= cost;
        stock.quantity += quantityToBuy;
        showMessage(`${name} ${quantityToBuy}주를 ${cost.toLocaleString()}원에 매수했습니다.`, 'success');
        addTransaction('buy', name, quantityToBuy, stock.price);
    } else {
        showMessage('자산이 부족합니다.', 'error');
    }
    updateUI();
    saveData(); // 매수 후 데이터 저장
}

// 주식 매도 함수
function sellStock(event, name) {
    event.stopPropagation(); // 부모 요소 클릭 이벤트 방지 (팝업 방지)
    const amountInput = document.getElementById(`amount-${name}`);
    const quantityToSell = parseInt(amountInput.value);

    if (isNaN(quantityToSell) || quantityToSell <= 0) {
        showMessage('유효한 수량을 입력해주세요.', 'error');
        return;
    }

    const stock = stocks[name];

    if (stock.quantity >= quantityToSell) {
        const profit = stock.price * quantityToSell;
        balance += profit;
        stock.quantity -= quantityToSell;
        showMessage(`${name} ${quantityToSell}주를 ${profit.toLocaleString()}원에 매도했습니다.`, 'success');
        addTransaction('sell', name, quantityToSell, stock.price);
    } else {
        showMessage('보유 수량이 부족합니다.', 'error');
    }
    updateUI();
    saveData(); // 매도 후 데이터 저장
}

// 주식 상세 팝업 표시 함수
function showStockModal(name) {
    const stock = stocks[name];
    modalStockName.textContent = name;
    modalCurrentPrice.textContent = stock.price.toLocaleString();

    let priceChange = stock.price - stock.lastPrice;
    let changeClass = '';
    let changeIndicator = '';

    if (stock.lastPrice !== 0 && stock.lastPrice !== undefined) {
        if (priceChange > 0) {
            changeClass = 'positive';
            changeIndicator = ` (+${priceChange.toLocaleString()})`;
        } else if (priceChange < 0) {
            changeClass = 'negative';
            changeIndicator = ` (${priceChange.toLocaleString()})`;
        }
    }
    modalPriceChange.className = `modal-change ${changeClass}`;
    modalPriceChange.textContent = changeIndicator;

    modalOwnedQuantity.textContent = stock.quantity;
    modalTotalValue.textContent = (stock.quantity * stock.price).toLocaleString();

    // Chart.js를 사용하여 그래프 그리기
    const ctx = document.getElementById('stockChart').getContext('2d');

    // 기존 차트가 있다면 파괴하여 메모리 누수 방지
    if (currentChart) {
        currentChart.destroy();
    }

    // Chart.js 차트 생성
    currentChart = new Chart(ctx, {
        type: 'line', // 선 그래프
        data: {
            labels: Array.from({ length: stock.priceHistory.length }, (_, i) => `${i + 1}회차`), // X축 라벨 (예: 1회차, 2회차...)
            datasets: [{
                label: `${name} 가격`,
                data: stock.priceHistory,
                borderColor: '#1a73e8', // 선 색상
                backgroundColor: 'rgba(26, 115, 232, 0.2)', // 배경 채우기 색상
                fill: true, // 선 아래 영역 채우기
                tension: 0.1 // 선의 부드러움 정도
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // 컨테이너 크기에 맞춰 조절
            scales: {
                y: {
                    beginAtZero: false, // Y축을 0부터 시작하지 않음 (가격 변화를 더 잘 보여줌)
                    title: {
                        display: true,
                        text: '가격 (원)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '변동 횟수'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw.toLocaleString()}원`;
                        }
                    }
                }
            }
        }
    });

    stockModal.style.display = 'flex'; // Flexbox를 사용하여 중앙 정렬
}

// 팝업 닫기 이벤트
closeButton.onclick = function() {
    stockModal.style.display = 'none';
    // 팝업 닫을 때 차트 인스턴스 파괴 (메모리 관리)
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}

// 팝업 외부 클릭 시 닫기
window.onclick = function(event) {
    if (event.target == stockModal) {
        stockModal.style.display = 'none';
        // 팝업 닫을 때 차트 인스턴스 파괴 (메모리 관리)
        if (currentChart) {
            currentChart.destroy();
            currentChart = null;
        }
    }
}

// 남은 시간 카운트다운 함수
function startCountdown() {
    clearInterval(countdownInterval); // 기존 인터벌이 있다면 제거
    timeLeft = updateInterval / 1000; // 초기 시간 설정 (30초)
    timeToNextFluctuationEl.textContent = timeLeft; // 즉시 업데이트

    countdownInterval = setInterval(() => {
        timeLeft--;
        timeToNextFluctuationEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(countdownInterval); // 0초가 되면 인터벌 중지
            // fluctuatePrices 함수는 setInterval에 의해 다시 호출될 것이므로 여기서 다시 시작할 필요 없음
        }
    }, 1000); // 1초마다 감소
}

// 카운트다운 재설정
function resetCountdown() {
    clearInterval(countdownInterval); // 기존 인터벌 중지
    startCountdown(); // 새롭게 카운트다운 시작
}

// 초기 로드 시 데이터 로드 및 UI 업데이트
loadData();
updateUI();
startCountdown(); // 페이지 로드 시 카운트다운 시작

// 30초마다 가격 변동 및 UI 업데이트
setInterval(fluctuatePrices, updateInterval);
