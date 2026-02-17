import 'package:riverpod/riverpod.dart';

import '../../core/api/auth_api_client.dart';
import '../../core/cache/profile_cache_repository.dart';
import '../../core/storage/token_storage.dart';
import '../../generated/studioos_api_client.dart';
import 'auth_state.dart';

class AuthController extends StateNotifier<AuthState> {
  AuthController({
    required AuthApiClientPort apiClient,
    required TokenStoragePort tokenStorage,
    required ProfileCacheRepositoryPort profileCacheRepository,
  }) : _apiClient = apiClient,
       _tokenStorage = tokenStorage,
       _profileCacheRepository = profileCacheRepository,
       super(AuthState.initial);

  final AuthApiClientPort _apiClient;
  final TokenStoragePort _tokenStorage;
  final ProfileCacheRepositoryPort _profileCacheRepository;

  Future<void> initialize() async {
    if (state.isInitialized) {
      return;
    }

    state = state.copyWith(isLoading: true, clearError: true);

    final (accessToken, refreshToken) = await _tokenStorage.readTokens();
    final cachedProfile = await _profileCacheRepository.readProfile();
    state = state.copyWith(
      isInitialized: true,
      isLoading: false,
      accessToken: accessToken,
      refreshToken: refreshToken,
      profile: cachedProfile,
      clearError: true,
    );

    if (accessToken != null && accessToken.isNotEmpty) {
      await fetchProfile(allowCachedFallback: true);
    }
  }

  Future<void> login({required String email, required String password}) async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final tokens = await _apiClient.login(email: email, password: password);
      final accessToken = tokens?['accessToken'] as String?;
      final refreshToken = tokens?['refreshToken'] as String?;

      if (accessToken == null || refreshToken == null) {
        throw StudioOsApiException(500, 'Token response missing fields');
      }

      await _tokenStorage.writeTokens(
        accessToken: accessToken,
        refreshToken: refreshToken,
      );
      state = state.copyWith(
        isInitialized: true,
        isLoading: false,
        accessToken: accessToken,
        refreshToken: refreshToken,
        clearError: true,
      );

      await fetchProfile(allowCachedFallback: true);
    } on StudioOsApiException catch (error) {
      state = state.copyWith(
        isInitialized: true,
        isLoading: false,
        errorMessage: error.message,
      );
    }
  }

  Future<void> fetchProfile({required bool allowCachedFallback}) async {
    final accessToken = state.accessToken;
    if (accessToken == null || accessToken.isEmpty) {
      return;
    }

    try {
      final profile = await _apiClient.getProfile();
      if (profile != null) {
        await _profileCacheRepository.writeProfile(profile);
      }
      state = state.copyWith(profile: profile, clearError: true);
    } on StudioOsApiException catch (error) {
      if (allowCachedFallback) {
        final cachedProfile = await _profileCacheRepository.readProfile();
        if (cachedProfile != null) {
          state = state.copyWith(
            profile: cachedProfile,
            errorMessage: error.message,
          );
          return;
        }
      }
      state = state.copyWith(errorMessage: error.message);
    }
  }

  Future<void> logout() async {
    final refreshToken = state.refreshToken;

    if (refreshToken != null && refreshToken.isNotEmpty) {
      await _apiClient.logout(refreshToken: refreshToken);
    }

    await _tokenStorage.clearTokens();
    await _profileCacheRepository.clearProfile();
    state = const AuthState(isInitialized: true, isLoading: false);
  }
}
