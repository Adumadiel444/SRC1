
<?php
// add_supplier_entry.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Para desarrollo, considera restringirlo en producción
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Solicitud pre-vuelo CORS
    http_response_code(200);
    exit;
}

// --- INICIO: Configuración de la Base de Datos (ajusta según tu entorno) ---
$db_host = 'localhost';
$db_name = 'tu_base_de_datos';
$db_user = 'tu_usuario_db';
$db_pass = 'tu_contraseña_db';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error de conexión a la base de datos: ' . $e->getMessage()]);
    exit;
}
// --- FIN: Configuración de la Base de Datos ---

// Obtener datos JSON del cuerpo de la solicitud
$input_data = json_decode(file_get_contents('php://input'), true);

if (!$input_data) {
    http_response_code(400);
    echo json_encode(['error' => 'Datos JSON inválidos o no proporcionados.']);
    exit;
}

// Validación básica de los datos de entrada
if (empty($input_data['supplierName']) || empty($input_data['pointOfSale']) || empty($input_data['userId']) || !isset($input_data['products']) || !is_array($input_data['products']) || empty($input_data['products'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Faltan campos requeridos o la lista de productos está vacía. Campos requeridos: supplierName, pointOfSale, userId, products (array).']);
    exit;
}

$supplier_name = trim($input_data['supplierName']);
$point_of_sale_name = trim($input_data['pointOfSale']);
$user_app_id = trim($input_data['userId']); // ID de la app del usuario
$products_payload = $input_data['products'];
$user_name_at_entry = isset($input_data['userName']) ? trim($input_data['userName']) : null;

// Iniciar transacción
$pdo->beginTransaction();

try {
    // 1. Obtener pos_id
    $stmt_pos = $pdo->prepare("SELECT pos_id FROM points_of_sale WHERE name = :pos_name");
    $stmt_pos->bindParam(':pos_name', $point_of_sale_name);
    $stmt_pos->execute();
    $pos_row = $stmt_pos->fetch();
    if (!$pos_row) {
        throw new Exception("Punto de Venta no encontrado: " . $point_of_sale_name);
    }
    $pos_id = $pos_row['pos_id'];

    // 2. Obtener user_id_internal (opcional, si el usuario existe)
    $user_id_internal = null;
    if ($user_app_id) {
        $stmt_user = $pdo->prepare("SELECT user_id_internal FROM users WHERE user_app_id = :user_app_id");
        $stmt_user->bindParam(':user_app_id', $user_app_id);
        $stmt_user->execute();
        $user_row = $stmt_user->fetch();
        if ($user_row) {
            $user_id_internal = $user_row['user_id_internal'];
        } else {
            // Si no se encuentra el usuario por user_app_id, se puede decidir si continuar o lanzar error.
            // Por ahora, se permite continuar, pero userName_at_entry será más importante.
            // Considera registrar un log aquí.
        }
    }
    
    // 3. Insertar en supplier_entries
    $entry_id = 'supplier-' . time() . '-' . bin2hex(random_bytes(4)); // Generar ID único
    $date_time = date('Y-m-d H:i:s'); // Fecha y hora actual

    $sql_supplier_entry = "INSERT INTO supplier_entries (entry_id, date_time, supplier_name, pos_id, user_id_internal, user_name_at_entry) 
                           VALUES (:entry_id, :date_time, :supplier_name, :pos_id, :user_id_internal, :user_name_at_entry)";
    $stmt_supplier_entry = $pdo->prepare($sql_supplier_entry);
    $stmt_supplier_entry->execute([
        ':entry_id' => $entry_id,
        ':date_time' => $date_time,
        ':supplier_name' => $supplier_name,
        ':pos_id' => $pos_id,
        ':user_id_internal' => $user_id_internal,
        ':user_name_at_entry' => $user_name_at_entry
    ]);

    $processed_products_for_response = [];

    // 4. Procesar cada producto
    foreach ($products_payload as $product_data) {
        if (empty($product_data['barcode']) || empty($product_data['productName']) || empty($product_data['brandName']) || !isset($product_data['quantity']) || $product_data['quantity'] <= 0 || !isset($product_data['purchasePrice']) || $product_data['purchasePrice'] <= 0) {
            throw new Exception("Datos de producto inválidos para el código de barras: " . ($product_data['barcode'] ?? 'N/A') . ". Todos los productos deben tener barcode, productName, brandName, quantity (>0) y purchasePrice (>0).");
        }

        $barcode = trim($product_data['barcode']);
        $product_name = trim($product_data['productName']);
        $brand_name = trim($product_data['brandName']);
        $quantity_received = intval($product_data['quantity']);
        $purchase_price = floatval($product_data['purchasePrice']);
        
        // Campos opcionales del producto
        $selling_price_payload = isset($product_data['sellingPrice']) && is_numeric($product_data['sellingPrice']) ? floatval($product_data['sellingPrice']) : null;
        $image_url_payload = isset($product_data['imageUrl']) ? trim($product_data['imageUrl']) : null;
        $description_payload = isset($product_data['description']) ? trim($product_data['description']) : null;
        $ai_hint_payload = isset($product_data['aiHint']) ? trim($product_data['aiHint']) : null;
        $wholesale_threshold_payload = isset($product_data['wholesaleQuantityThreshold']) && is_numeric($product_data['wholesaleQuantityThreshold']) ? intval($product_data['wholesaleQuantityThreshold']) : null;
        $wholesale_price_payload = isset($product_data['wholesalePrice']) && is_numeric($product_data['wholesalePrice']) ? floatval($product_data['wholesalePrice']) : null;
        $low_stock_threshold_payload = isset($product_data['lowStockThreshold']) && is_numeric($product_data['lowStockThreshold']) ? intval($product_data['lowStockThreshold']) : null;

        // a. Verificar/Insertar/Actualizar en la tabla `products`
        $stmt_product = $pdo->prepare("SELECT * FROM products WHERE barcode = :barcode");
        $stmt_product->bindParam(':barcode', $barcode);
        $stmt_product->execute();
        $existing_product = $stmt_product->fetch();

        $old_selling_price_for_item_entry = null; // Para registrar en supplier_entry_items

        if (!$existing_product) {
            // Producto nuevo para el sistema
            $default_selling_price = $selling_price_payload ?? ($purchase_price * 1.5); // Lógica de precio por defecto si no se provee

            $sql_insert_product = "INSERT INTO products (barcode, name, brand_name, default_selling_price, image_url, description, ai_hint, wholesale_quantity_threshold, wholesale_price, default_low_stock_threshold) 
                                   VALUES (:barcode, :name, :brand_name, :default_selling_price, :image_url, :description, :ai_hint, :wholesale_quantity_threshold, :wholesale_price, :default_low_stock_threshold)";
            $stmt_insert_product = $pdo->prepare($sql_insert_product);
            $stmt_insert_product->execute([
                ':barcode' => $barcode,
                ':name' => $product_name,
                ':brand_name' => $brand_name,
                ':default_selling_price' => $default_selling_price,
                ':image_url' => $image_url_payload,
                ':description' => $description_payload,
                ':ai_hint' => $ai_hint_payload,
                ':wholesale_quantity_threshold' => $wholesale_threshold_payload,
                ':wholesale_price' => $wholesale_price_payload,
                ':default_low_stock_threshold' => $low_stock_threshold_payload 
            ]);
            $old_selling_price_for_item_entry = null; // Es nuevo, no hay precio antiguo
        } else {
            // Producto existente, actualizar detalles globales si se proporcionan
            $old_selling_price_for_item_entry = $existing_product['default_selling_price'];

            $update_product_fields = [];
            $update_product_params = [':barcode' => $barcode];
            
            if ($product_name !== $existing_product['name']) { $update_product_fields[] = "name = :name"; $update_product_params[':name'] = $product_name; }
            if ($brand_name !== $existing_product['brand_name']) { $update_product_fields[] = "brand_name = :brand_name"; $update_product_params[':brand_name'] = $brand_name; }
            if ($image_url_payload !== null && $image_url_payload !== $existing_product['image_url']) { $update_product_fields[] = "image_url = :image_url"; $update_product_params[':image_url'] = $image_url_payload; }
            if ($description_payload !== null && $description_payload !== $existing_product['description']) { $update_product_fields[] = "description = :description"; $update_product_params[':description'] = $description_payload; }
            if ($ai_hint_payload !== null && $ai_hint_payload !== $existing_product['ai_hint']) { $update_product_fields[] = "ai_hint = :ai_hint"; $update_product_params[':ai_hint'] = $ai_hint_payload; }
            if ($wholesale_threshold_payload !== null && $wholesale_threshold_payload != $existing_product['wholesale_quantity_threshold']) { $update_product_fields[] = "wholesale_quantity_threshold = :wholesale_quantity_threshold"; $update_product_params[':wholesale_quantity_threshold'] = $wholesale_threshold_payload; }
            if ($wholesale_price_payload !== null && $wholesale_price_payload != $existing_product['wholesale_price']) { $update_product_fields[] = "wholesale_price = :wholesale_price"; $update_product_params[':wholesale_price'] = $wholesale_price_payload; }
            
            // Nota: default_low_stock_threshold y default_selling_price se manejan con más cuidado,
            // priorizando los específicos del PDV. Actualizarlos aquí si no hay valores específicos.
            // Aquí solo actualizaremos `default_low_stock_threshold` si se proporciona y es diferente.
            if ($low_stock_threshold_payload !== null && $low_stock_threshold_payload != $existing_product['default_low_stock_threshold']) {
                 $update_product_fields[] = "default_low_stock_threshold = :default_low_stock_threshold";
                 $update_product_params[':default_low_stock_threshold'] = $low_stock_threshold_payload;
            }

            if (count($update_product_fields) > 0) {
                $sql_update_product = "UPDATE products SET " . implode(", ", $update_product_fields) . " WHERE barcode = :barcode";
                $stmt_update_product = $pdo->prepare($sql_update_product);
                $stmt_update_product->execute($update_product_params);
            }
        }

        // b. Insertar en supplier_entry_items
        $sql_entry_item = "INSERT INTO supplier_entry_items (entry_id, product_barcode, quantity_received, purchase_price_per_unit, product_description_at_entry, old_selling_price_at_entry, new_selling_price_at_entry, wholesale_quantity_threshold_at_entry, wholesale_price_at_entry, low_stock_threshold_at_entry)
                           VALUES (:entry_id, :product_barcode, :quantity_received, :purchase_price, :description, :old_selling_price, :new_selling_price, :wholesale_q_thresh, :wholesale_p, :low_stock_thresh)";
        $stmt_entry_item = $pdo->prepare($sql_entry_item);
        $stmt_entry_item->execute([
            ':entry_id' => $entry_id,
            ':product_barcode' => $barcode,
            ':quantity_received' => $quantity_received,
            ':purchase_price' => $purchase_price,
            ':description' => $description_payload, // Descripción al momento de la entrada
            ':old_selling_price' => $old_selling_price_for_item_entry, // Se necesita el precio de venta del producto antes de esta entrada para este PDV
            ':new_selling_price' => $selling_price_payload, // El precio de venta que se está estableciendo/actualizando para el PDV
            ':wholesale_q_thresh' => $wholesale_threshold_payload,
            ':wholesale_p' => $wholesale_price_payload,
            ':low_stock_thresh' => $low_stock_threshold_payload
        ]);

        // c. Actualizar/Insertar en inventory_stock
        $stmt_stock = $pdo->prepare("SELECT stock_id, quantity, pos_specific_selling_price, pos_specific_low_stock_threshold FROM inventory_stock WHERE product_barcode = :barcode AND pos_id = :pos_id");
        $stmt_stock->bindParam(':barcode', $barcode);
        $stmt_stock->bindParam(':pos_id', $pos_id);
        $stmt_stock->execute();
        $existing_stock_item = $stmt_stock->fetch();
        
        $current_pos_selling_price = $existing_stock_item ? $existing_stock_item['pos_specific_selling_price'] : ($existing_product ? $existing_product['default_selling_price'] : ($purchase_price * 1.5));
        $old_selling_price_for_item_entry = $current_pos_selling_price; // Para `supplier_entry_items`, este es el precio de venta en el PDV antes del cambio


        if ($existing_stock_item) {
            // Actualizar stock existente
            $new_quantity_in_stock = $existing_stock_item['quantity'] + $quantity_received;
            $sql_update_stock = "UPDATE inventory_stock SET quantity = :quantity, last_stocked_at = NOW()";
            $update_stock_params = [':quantity' => $new_quantity_in_stock, ':stock_id' => $existing_stock_item['stock_id']];

            if ($selling_price_payload !== null) {
                $sql_update_stock .= ", pos_specific_selling_price = :pos_selling_price";
                $update_stock_params[':pos_selling_price'] = $selling_price_payload;
            }
            if ($low_stock_threshold_payload !== null) {
                $sql_update_stock .= ", pos_specific_low_stock_threshold = :pos_low_stock_thresh";
                $update_stock_params[':pos_low_stock_thresh'] = $low_stock_threshold_payload;
            }
            $sql_update_stock .= " WHERE stock_id = :stock_id";
            $stmt_update_stock = $pdo->prepare($sql_update_stock);
            $stmt_update_stock->execute($update_stock_params);
        } else {
            // Insertar nuevo registro de stock para este producto en este PDV
            $pos_specific_price = $selling_price_payload ?? ($existing_product ? $existing_product['default_selling_price'] : ($purchase_price * 1.5));
            $pos_specific_low_thresh = $low_stock_threshold_payload ?? ($existing_product ? $existing_product['default_low_stock_threshold'] : null);

            $sql_insert_stock = "INSERT INTO inventory_stock (product_barcode, pos_id, quantity, pos_specific_selling_price, pos_specific_low_stock_threshold, last_stocked_at) 
                                 VALUES (:barcode, :pos_id, :quantity, :pos_selling_price, :pos_low_stock_thresh, NOW())";
            $stmt_insert_stock = $pdo->prepare($sql_insert_stock);
            $stmt_insert_stock->execute([
                ':barcode' => $barcode,
                ':pos_id' => $pos_id,
                ':quantity' => $quantity_received,
                ':pos_selling_price' => $pos_specific_price,
                ':pos_low_stock_thresh' => $pos_specific_low_thresh
            ]);
        }
         // Preparar datos del producto para la respuesta
        $processed_products_for_response[] = [
            'barcode' => $barcode,
            'productName' => $product_name,
            'brandName' => $brand_name,
            'quantity' => $quantity_received,
            'purchasePrice' => $purchase_price,
            'description' => $description_payload,
            'oldSellingPrice' => $old_selling_price_for_item_entry, 
            'newSellingPrice' => $selling_price_payload,
            'wholesaleQuantityThreshold' => $wholesale_threshold_payload,
            'wholesalePrice' => $wholesale_price_payload,
            'lowStockThreshold' => $low_stock_threshold_payload
        ];
    }

    // Confirmar transacción
    $pdo->commit();

    // Construir la respuesta que espera el frontend
    $response_data = [
        'id' => $entry_id,
        'dateTime' => $date_time,
        'supplierName' => $supplier_name,
        'pointOfSale' => $point_of_sale_name,
        'userId' => $user_app_id, // El frontend espera el app_id
        'userName' => $user_name_at_entry,
        'products' => $processed_products_for_response
    ];

    http_response_code(201); // Creado
    echo json_encode($response_data);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'Error al procesar la entrada del proveedor: ' . $e->getMessage(), 'trace' => $e->getTraceAsString()]);
    exit;
}
?>
