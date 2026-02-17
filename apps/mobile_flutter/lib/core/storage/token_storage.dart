import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract class TokenStoragePort {
  Future<(String?, String?)> readTokens();
  Future<void> writeTokens({
    required String accessToken,
    required String refreshToken,
  });
  Future<void> clearTokens();
}

class TokenStorage implements TokenStoragePort {
  TokenStorage({FlutterSecureStorage? secureStorage})
    : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  static const _accessTokenKey = 'studioos.access_token';
  static const _refreshTokenKey = 'studioos.refresh_token';

  final FlutterSecureStorage _secureStorage;

  @override
  Future<(String?, String?)> readTokens() async {
    final accessToken = await _secureStorage.read(key: _accessTokenKey);
    final refreshToken = await _secureStorage.read(key: _refreshTokenKey);
    return (accessToken, refreshToken);
  }

  @override
  Future<void> writeTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _secureStorage.write(key: _accessTokenKey, value: accessToken);
    await _secureStorage.write(key: _refreshTokenKey, value: refreshToken);
  }

  @override
  Future<void> clearTokens() async {
    await _secureStorage.delete(key: _accessTokenKey);
    await _secureStorage.delete(key: _refreshTokenKey);
  }
}
