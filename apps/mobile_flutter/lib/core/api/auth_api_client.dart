import '../../generated/studioos_api_client.dart';

abstract class AuthApiClientPort {
  Future<Map<String, dynamic>?> login({
    required String email,
    required String password,
  });

  Future<void> logout({required String refreshToken});

  Future<Map<String, dynamic>?> getProfile();
}

class AuthApiClient implements AuthApiClientPort {
  AuthApiClient(this._client);

  final StudioOsApiClient _client;

  @override
  Future<Map<String, dynamic>?> login({
    required String email,
    required String password,
  }) {
    return _client.login(email: email, password: password);
  }

  @override
  Future<void> logout({required String refreshToken}) {
    return _client.logout(refreshToken: refreshToken);
  }

  @override
  Future<Map<String, dynamic>?> getProfile() {
    return _client.getProfile();
  }
}
