// State management
let products = JSON.parse(localStorage.getItem('products')) || [];
let recipes = JSON.parse(localStorage.getItem('recipes')) || [];
let cart = [];
let dailySales = JSON.parse(localStorage.getItem('dailySales')) || {
    total: 0,
    count: 0,
    date: new Date().toISOString().split('T')[0]
};
let salesHistory = JSON.parse(localStorage.getItem('salesHistory')) || [];
let receiptCounter = parseInt(localStorage.getItem('receiptCounter')) || 1;

// Data saving functions
function saveData() {
    try {
        localStorage.setItem('products', JSON.stringify(products));
        localStorage.setItem('recipes', JSON.stringify(recipes));
        localStorage.setItem('dailySales', JSON.stringify(dailySales));
        localStorage.setItem('salesHistory', JSON.stringify(salesHistory));
        localStorage.setItem('receiptCounter', receiptCounter);
        
        // Create backup in IndexedDB
        createBackup();
        
        // Show success message
        showNotification('Daten erfolgreich gespeichert', 'success');
    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        showNotification('Fehler beim Speichern der Daten', 'error');
    }
}

// IndexedDB backup system
let db;
const request = indexedDB.open('LimonadenstandDB', 1);

request.onerror = (event) => {
    console.error('IndexedDB Fehler:', event.target.error);
};

request.onupgradeneeded = (event) => {
    db = event.target.result;
    
    // Create object stores
    if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('recipes')) {
        db.createObjectStore('recipes', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('salesHistory')) {
        db.createObjectStore('salesHistory', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('dailySales')) {
        db.createObjectStore('dailySales', { keyPath: 'date' });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log('IndexedDB Verbindung hergestellt');
};

function createBackup() {
    if (!db) return;

    const transaction = db.transaction(['products', 'recipes', 'salesHistory', 'dailySales'], 'readwrite');
    
    // Save products
    const productsStore = transaction.objectStore('products');
    products.forEach(product => {
        productsStore.put(product);
    });

    // Save recipes
    const recipesStore = transaction.objectStore('recipes');
    recipes.forEach(recipe => {
        recipesStore.put(recipe);
    });

    // Save sales history
    const salesHistoryStore = transaction.objectStore('salesHistory');
    salesHistory.forEach(sale => {
        salesHistoryStore.put(sale);
    });

    // Save daily sales
    const dailySalesStore = transaction.objectStore('dailySales');
    dailySalesStore.put(dailySales);

    transaction.oncomplete = () => {
        console.log('Backup erfolgreich erstellt');
    };

    transaction.onerror = (error) => {
        console.error('Backup Fehler:', error);
    };
}

// Auto-save functionality
let autoSaveTimeout;
function scheduleAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        saveData();
    }, 5000); // Save every 5 seconds after last change
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} notification`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Tab navigation
document.querySelectorAll('.nav-link').forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = e.target.id.replace('-tab', '-section');
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(targetId).classList.add('active');
    });
});

// Product management
document.getElementById('product-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('product-name').value;
    const price = parseFloat(document.getElementById('product-price').value);
    
    products.push({ id: Date.now(), name, price });
    saveData();
    
    updateProductList();
    updateProductButtons();
    e.target.reset();
});

function updateProductList() {
    const productsList = document.getElementById('products-list');
    productsList.innerHTML = products.map(product => `
        <div class="product-list-item">
            <span>${product.name} - ${product.price.toFixed(2)} €</span>
            <button class="btn btn-danger btn-sm" onclick="deleteProduct(${product.id})">Löschen</button>
        </div>
    `).join('');
}

function deleteProduct(id) {
    products = products.filter(p => p.id !== id);
    saveData();
    updateProductList();
    updateProductButtons();
}

// Recipe management
function addIngredientField() {
    const ingredientsList = document.getElementById('ingredients-list');
    const ingredientDiv = document.createElement('div');
    ingredientDiv.className = 'ingredient-field mb-2';
    ingredientDiv.innerHTML = `
        <div class="input-group">
            <input type="text" class="form-control" placeholder="Menge" required>
            <input type="text" class="form-control" placeholder="Einheit" required>
            <input type="text" class="form-control" placeholder="Zutat" required>
            <button type="button" class="btn btn-danger" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    ingredientsList.appendChild(ingredientDiv);
}

function updateRecipeProductSelect() {
    const select = document.getElementById('recipe-product');
    select.innerHTML = '<option value="">Kein Produkt verknüpfen</option>' +
        products.map(product => `
            <option value="${product.id}">${product.name}</option>
        `).join('');
}

document.getElementById('recipe-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('recipe-name').value;
    const category = document.getElementById('recipe-category').value;
    const time = parseInt(document.getElementById('recipe-time').value);
    const instructions = document.getElementById('recipe-instructions').value;
    const productId = document.getElementById('recipe-product').value;
    
    // Collect ingredients
    const ingredients = Array.from(document.querySelectorAll('.ingredient-field')).map(field => {
        const inputs = field.querySelectorAll('input');
        return {
            amount: inputs[0].value,
            unit: inputs[1].value,
            name: inputs[2].value
        };
    });
    
    recipes.push({
        id: Date.now(),
        name,
        category,
        time,
        ingredients,
        instructions,
        productId: productId || null
    });
    
    saveData();
    updateRecipeList();
    e.target.reset();
    document.getElementById('ingredients-list').innerHTML = '';
});

function updateRecipeList() {
    const recipesList = document.getElementById('recipes-list');
    const searchTerm = document.getElementById('recipe-search').value.toLowerCase();
    
    const filteredRecipes = recipes.filter(recipe => 
        recipe.name.toLowerCase().includes(searchTerm) ||
        recipe.category.toLowerCase().includes(searchTerm)
    );
    
    recipesList.innerHTML = filteredRecipes.map(recipe => `
        <div class="recipe-card">
            <div class="d-flex justify-content-between align-items-start">
                <h5>${recipe.name}</h5>
                <span class="badge bg-primary">${recipe.category}</span>
            </div>
            <div class="recipe-meta text-muted mb-2">
                <small>Zubereitungszeit: ${recipe.time} Minuten</small>
            </div>
            <div class="recipe-ingredients">
                <strong>Zutaten:</strong><br>
                ${recipe.ingredients.map(ing => 
                    `${ing.amount} ${ing.unit} ${ing.name}`
                ).join('<br>')}
            </div>
            <div class="recipe-instructions mt-2">
                <strong>Anleitung:</strong><br>
                ${recipe.instructions}
            </div>
            ${recipe.productId ? `
                <div class="mt-2">
                    <small class="text-muted">Verknüpftes Produkt: ${products.find(p => p.id === recipe.productId)?.name}</small>
                </div>
            ` : ''}
            <div class="mt-2">
                <button class="btn btn-danger btn-sm" onclick="deleteRecipe(${recipe.id})">Löschen</button>
                <button class="btn btn-primary btn-sm" onclick="editRecipe(${recipe.id})">Bearbeiten</button>
            </div>
        </div>
    `).join('');
}

function editRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;
    
    document.getElementById('recipe-name').value = recipe.name;
    document.getElementById('recipe-category').value = recipe.category;
    document.getElementById('recipe-time').value = recipe.time;
    document.getElementById('recipe-instructions').value = recipe.instructions;
    document.getElementById('recipe-product').value = recipe.productId || '';
    
    const ingredientsList = document.getElementById('ingredients-list');
    ingredientsList.innerHTML = '';
    recipe.ingredients.forEach(ing => {
        const ingredientDiv = document.createElement('div');
        ingredientDiv.className = 'ingredient-field mb-2';
        ingredientDiv.innerHTML = `
            <div class="input-group">
                <input type="text" class="form-control" placeholder="Menge" value="${ing.amount}" required>
                <input type="text" class="form-control" placeholder="Einheit" value="${ing.unit}" required>
                <input type="text" class="form-control" placeholder="Zutat" value="${ing.name}" required>
                <button type="button" class="btn btn-danger" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        ingredientsList.appendChild(ingredientDiv);
    });
    
    // Remove the old recipe
    recipes = recipes.filter(r => r.id !== id);
    saveData();
    updateRecipeList();
}

// Add search functionality
document.getElementById('recipe-search').addEventListener('input', updateRecipeList);

// Initialize recipe form with one ingredient field
document.addEventListener('DOMContentLoaded', () => {
    addIngredientField();
    updateRecipeProductSelect();
    updateSalesHistory();
});

// Cart functionality
function updateProductButtons() {
    const productButtons = document.getElementById('product-buttons');
    productButtons.innerHTML = products.map(product => `
        <button class="product-button" onclick="addToCart(${product.id})">
            ${product.name} - ${product.price.toFixed(2)} €
        </button>
    `).join('');
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const cartItem = cart.find(item => item.productId === productId);
    
    if (cartItem) {
        cartItem.quantity++;
    } else {
        cart.push({
            productId,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }
    
    updateCart();
    scheduleAutoSave();
}

function updateCart() {
    const cartItems = document.getElementById('cart-items');
    const totalAmount = document.getElementById('total-amount');
    
    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <span>${item.name}</span>
            <div class="quantity-controls">
                <button class="btn btn-sm btn-quantity" onclick="updateQuantity(${item.productId}, -1)">-</button>
                <span>${item.quantity}</span>
                <button class="btn btn-sm btn-quantity" onclick="updateQuantity(${item.productId}, 1)">+</button>
                <button class="btn btn-danger btn-sm ms-2" onclick="removeFromCart(${item.productId})">×</button>
            </div>
            <span>${(item.price * item.quantity).toFixed(2)} €</span>
        </div>
    `).join('');
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalAmount.textContent = total.toFixed(2);
}

function updateQuantity(productId, change) {
    const cartItem = cart.find(item => item.productId === productId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(productId);
        } else {
            updateCart();
        }
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.productId !== productId);
    updateCart();
}

function checkout() {
    if (cart.length === 0) {
        alert('Der Warenkorb ist leer!');
        return;
    }
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Show payment modal
    const paymentModal = new bootstrap.Modal(document.getElementById('paymentModal'));
    document.getElementById('payment-amount').textContent = total.toFixed(2);
    document.getElementById('payment-input').value = '';
    document.getElementById('change-amount').textContent = '0.00';
    paymentModal.show();
}

function calculateChange() {
    const total = parseFloat(document.getElementById('payment-amount').textContent);
    const paid = parseFloat(document.getElementById('payment-input').value) || 0;
    const change = paid - total;
    
    if (change >= 0) {
        document.getElementById('change-amount').textContent = change.toFixed(2);
        document.getElementById('change-amount').classList.remove('text-danger');
        document.getElementById('change-amount').classList.add('text-success');
        document.getElementById('confirm-payment').disabled = false;
    } else {
        document.getElementById('change-amount').textContent = Math.abs(change).toFixed(2);
        document.getElementById('change-amount').classList.remove('text-success');
        document.getElementById('change-amount').classList.add('text-danger');
        document.getElementById('confirm-payment').disabled = true;
    }
}

function confirmPayment() {
    const total = parseFloat(document.getElementById('payment-amount').textContent);
    const paid = parseFloat(document.getElementById('payment-input').value);
    const change = paid - total;
    
    if (change < 0) {
        alert('Bitte geben Sie einen ausreichenden Betrag ein!');
        return;
    }
    
    // Update daily sales
    const today = new Date().toISOString().split('T')[0];
    if (dailySales.date !== today) {
        dailySales = { total: 0, count: 0, date: today };
    }
    
    dailySales.total += total;
    dailySales.count += cart.reduce((sum, item) => sum + item.quantity, 0);
    
    // Save to sales history
    const now = new Date();
    const sale = {
        id: Date.now(),
        receiptNumber: receiptCounter++,
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString('de-DE'),
        items: [...cart],
        total: total,
        paid: paid,
        change: change
    };
    
    salesHistory.push(sale);
    
    // Save all changes
    saveData();
    
    // Clear cart
    cart = [];
    updateCart();
    
    // Update daily summary
    updateDailySummary();
    
    // Close payment modal
    const paymentModal = bootstrap.Modal.getInstance(document.getElementById('paymentModal'));
    paymentModal.hide();
    
    // Show receipt
    generateReceipt(sale);
    
    alert(`Vielen Dank für Ihren Einkauf!\nGesamtbetrag: ${total.toFixed(2)} €\nRückgeld: ${change.toFixed(2)} €`);
}

function generateReceipt(sale = null) {
    const now = new Date();
    const receiptNumber = sale ? sale.receiptNumber : receiptCounter;
    const date = sale ? sale.date : now.toISOString().split('T')[0];
    const time = sale ? sale.time : now.toLocaleTimeString('de-DE');
    const items = sale ? sale.items : cart;
    const total = sale ? sale.total : cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const paid = sale ? sale.paid : 0;
    const change = sale ? sale.change : 0;
    
    document.getElementById('receipt-number').textContent = receiptNumber.toString().padStart(6, '0');
    document.getElementById('receipt-date').textContent = date;
    document.getElementById('receipt-time').textContent = time;
    
    const receiptItems = document.getElementById('receipt-items');
    receiptItems.innerHTML = items.map(item => `
        <div class="d-flex justify-content-between mb-2">
            <div>
                ${item.name} x ${item.quantity}
            </div>
            <div>
                ${(item.price * item.quantity).toFixed(2)} €
            </div>
        </div>
    `).join('');
    
    document.getElementById('receipt-total').textContent = total.toFixed(2);
    
    // Add payment information to receipt
    if (sale) {
        receiptItems.innerHTML += `
            <hr>
            <div class="d-flex justify-content-between mb-2">
                <div>Gegeben:</div>
                <div>${paid.toFixed(2)} €</div>
            </div>
            <div class="d-flex justify-content-between mb-2">
                <div>Rückgeld:</div>
                <div>${change.toFixed(2)} €</div>
            </div>
        `;
    }
    
    const receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
    receiptModal.show();
}

function printReceipt() {
    const receiptContent = document.getElementById('receipt-content');
    const printWindow = window.open('', '', 'height=600,width=400');
    printWindow.document.write(`
        <html>
            <head>
                <title>Beleg</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .text-center { text-align: center; }
                    .mb-3 { margin-bottom: 1rem; }
                    .mb-1 { margin-bottom: 0.25rem; }
                    hr { border: none; border-top: 1px solid #000; margin: 1rem 0; }
                    .d-flex { display: flex; }
                    .justify-content-between { justify-content: space-between; }
                    .mt-4 { margin-top: 1.5rem; }
                </style>
            </head>
            <body>
                ${receiptContent.innerHTML}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

function updateSalesHistory() {
    const salesHistoryTable = document.getElementById('sales-history');
    salesHistoryTable.innerHTML = salesHistory.map(sale => `
        <tr>
            <td>${sale.date}</td>
            <td>${sale.time}</td>
            <td>${sale.items.map(item => `${item.name} x ${item.quantity}`).join(', ')}</td>
            <td>${sale.total.toFixed(2)} €</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="generateReceipt(${JSON.stringify(sale)})">
                    Beleg anzeigen
                </button>
            </td>
        </tr>
    `).join('');
}

// Daily summary
function updateDailySummary() {
    document.getElementById('daily-total').textContent = dailySales.total.toFixed(2);
    document.getElementById('daily-sales').textContent = dailySales.count;
}

// PDF generation
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const today = new Date().toLocaleDateString('de-DE');
    
    doc.setFontSize(20);
    doc.text('Tagesabschluss', 20, 20);
    doc.setFontSize(12);
    doc.text(`Datum: ${today}`, 20, 30);
    doc.text(`Gesamtumsatz: ${dailySales.total.toFixed(2)} €`, 20, 40);
    doc.text(`Anzahl Verkäufe: ${dailySales.count}`, 20, 50);
    
    // Add sales history
    let y = 70;
    doc.text('Verkaufsverlauf:', 20, y);
    y += 10;
    
    const todaySales = salesHistory.filter(sale => sale.date === today);
    todaySales.forEach(sale => {
        doc.text(`Beleg Nr: ${sale.receiptNumber.toString().padStart(6, '0')}`, 30, y);
        y += 7;
        doc.text(`Zeit: ${sale.time}`, 30, y);
        y += 7;
        doc.text(`Betrag: ${sale.total.toFixed(2)} €`, 30, y);
        y += 10;
    });
    
    doc.save(`Tagesabschluss_${today}.pdf`);
}

// Add data recovery function
function recoverData() {
    if (!db) return;

    const transaction = db.transaction(['products', 'recipes', 'salesHistory', 'dailySales'], 'readonly');
    
    // Recover products
    const productsStore = transaction.objectStore('products');
    productsStore.getAll().onsuccess = (event) => {
        products = event.target.result;
        updateProductList();
        updateProductButtons();
    };

    // Recover recipes
    const recipesStore = transaction.objectStore('recipes');
    recipesStore.getAll().onsuccess = (event) => {
        recipes = event.target.result;
        updateRecipeList();
    };

    // Recover sales history
    const salesHistoryStore = transaction.objectStore('salesHistory');
    salesHistoryStore.getAll().onsuccess = (event) => {
        salesHistory = event.target.result;
        updateSalesHistory();
    };

    // Recover daily sales
    const dailySalesStore = transaction.objectStore('dailySales');
    dailySalesStore.getAll().onsuccess = (event) => {
        const dailySalesData = event.target.result;
        if (dailySalesData && dailySalesData.length > 0) {
            dailySales = dailySalesData[0];
            updateDailySummary();
        }
    };
}

// Add data export function
function exportData() {
    const data = {
        products,
        recipes,
        salesHistory,
        dailySales,
        receiptCounter
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `limonadenstand_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Add data import function
function importData(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            products = data.products || products;
            recipes = data.recipes || recipes;
            salesHistory = data.salesHistory || salesHistory;
            dailySales = data.dailySales || dailySales;
            receiptCounter = data.receiptCounter || receiptCounter;
            
            saveData();
            updateProductList();
            updateProductButtons();
            updateRecipeList();
            updateSalesHistory();
            updateDailySummary();
            
            showNotification('Daten erfolgreich importiert', 'success');
        } catch (error) {
            console.error('Import Fehler:', error);
            showNotification('Fehler beim Importieren der Daten', 'error');
        }
    };
    reader.readAsText(file);
}

// Add event listeners for data management
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    
    // Add data management buttons to the navbar
    const navbar = document.querySelector('.navbar-nav');
    navbar.innerHTML += `
        <li class="nav-item">
            <a class="nav-link" href="#" onclick="exportData()">Daten exportieren</a>
        </li>
        <li class="nav-item">
            <label class="nav-link" style="cursor: pointer;">
                Daten importieren
                <input type="file" accept=".json" style="display: none;" onchange="importData(this.files[0])">
            </label>
        </li>
    `;
    
    // Attempt to recover data from IndexedDB
    recoverData();
});

// Initialize
updateProductList();
updateProductButtons();
updateCart();
updateDailySummary(); 