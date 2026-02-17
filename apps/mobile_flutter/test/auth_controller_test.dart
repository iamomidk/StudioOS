import 'package:flutter_test/flutter_test.dart';
import 'package:studioos_mobile_flutter/core/api/auth_api_client.dart';
import 'package:studioos_mobile_flutter/core/cache/profile_cache_repository.dart';
import 'package:studioos_mobile_flutter/core/storage/token_storage.dart';
import 'package:studioos_mobile_flutter/features/auth/auth_controller.dart';
import 'package:studioos_mobile_flutter/generated/studioos_api_client.dart';

class _FakeAuthApiClient implements AuthApiClientPort {
  _FakeAuthApiClient({this.loginResult, this.profileResult, this.profileError});

  final Map<String, dynamic>? loginResult;
  final Map<String, dynamic>? profileResult;
  final StudioOsApiException? profileError;

  @override
  Future<Map<String, dynamic>?> login({
    required String email,
    required String password,
  }) async {
    return loginResult;
  }

  @override
  Future<void> logout({required String refreshToken}) async {}

  @override
  Future<Map<String, dynamic>?> getProfile() async {
    if (profileError != null) {
      throw profileError!;
    }
    return profileResult;
  }
}

class _FakeTokenStorage implements TokenStoragePort {
  _FakeTokenStorage(this.tokens);

  final (String?, String?) tokens;

  @override
  Future<void> clearTokens() async {}

  @override
  Future<(String?, String?)> readTokens() async => tokens;

  @override
  Future<void> writeTokens({
    required String accessToken,
    required String refreshToken,
  }) async {}
}

class _FakeProfileCacheRepository implements ProfileCacheRepositoryPort {
  _FakeProfileCacheRepository({this.cachedProfile});

  Map<String, dynamic>? cachedProfile;
  Map<String, dynamic>? writtenProfile;

  @override
  Future<void> clearProfile() async {
    cachedProfile = null;
  }

  @override
  Future<Map<String, dynamic>?> readProfile() async => cachedProfile;

  @override
  Future<void> writeProfile(Map<String, dynamic> profile) async {
    writtenProfile = profile;
  }
}

void main() {
  test(
    'initialize loads cached profile and keeps it when revalidate fails',
    () async {
      final cachedProfile = <String, dynamic>{
        'email': 'cached@studioos.dev',
        'firstName': 'Cached',
        'lastName': 'User',
        'roles': <String>['owner'],
      };

      final cache = _FakeProfileCacheRepository(cachedProfile: cachedProfile);
      final controller = AuthController(
        apiClient: _FakeAuthApiClient(
          profileError: StudioOsApiException(503, 'Server error'),
        ),
        tokenStorage: _FakeTokenStorage(('access-token', 'refresh-token')),
        profileCacheRepository: cache,
      );

      await controller.initialize();

      expect(controller.state.isInitialized, isTrue);
      expect(controller.state.profile?['email'], 'cached@studioos.dev');
      expect(controller.state.errorMessage, 'Server error');
    },
  );

  test('fetchProfile writes successful response into cache', () async {
    final profile = <String, dynamic>{
      'email': 'owner@studioos.dev',
      'firstName': 'Omid',
      'lastName': 'Owner',
      'roles': <String>['owner'],
    };
    final cache = _FakeProfileCacheRepository();
    final controller = AuthController(
      apiClient: _FakeAuthApiClient(profileResult: profile),
      tokenStorage: _FakeTokenStorage(('access-token', 'refresh-token')),
      profileCacheRepository: cache,
    );

    await controller.initialize();

    expect(cache.writtenProfile?['email'], 'owner@studioos.dev');
    expect(controller.state.profile?['email'], 'owner@studioos.dev');
  });
}
