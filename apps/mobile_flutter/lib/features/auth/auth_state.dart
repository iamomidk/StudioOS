class AuthState {
  const AuthState({
    required this.isInitialized,
    required this.isLoading,
    this.accessToken,
    this.refreshToken,
    this.profile,
    this.errorMessage,
  });

  final bool isInitialized;
  final bool isLoading;
  final String? accessToken;
  final String? refreshToken;
  final Map<String, dynamic>? profile;
  final String? errorMessage;

  bool get isAuthenticated => accessToken != null && accessToken!.isNotEmpty;

  AuthState copyWith({
    bool? isInitialized,
    bool? isLoading,
    String? accessToken,
    String? refreshToken,
    Map<String, dynamic>? profile,
    String? errorMessage,
    bool clearError = false,
    bool clearProfile = false,
  }) {
    return AuthState(
      isInitialized: isInitialized ?? this.isInitialized,
      isLoading: isLoading ?? this.isLoading,
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      profile: clearProfile ? null : (profile ?? this.profile),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }

  static const initial = AuthState(isInitialized: false, isLoading: false);
}
