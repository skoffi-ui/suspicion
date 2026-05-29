

<?php

error_reporting(E_ALL);
ini_set('display_errors', 1);

$url = "http://localhost:3000/devices/sync";

$response = @file_get_contents($url);

if ($response === false) {
    $response = "ERROR: Impossible d'appeler l'API";
}

$logFile = __DIR__ . '/sync.log';

file_put_contents(
    $logFile,
    date('Y-m-d H:i:s') . " => " . $response . PHP_EOL,
    FILE_APPEND
);

echo "SYNC DONE\n";