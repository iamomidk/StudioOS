import 'dart:convert';

import 'package:http/http.dart' as http;

import '../storage/token_storage.dart';

abstract class SupportApiClientPort {
  Future<void> submitIssue({
    required String organizationId,
    required String title,
    required String description,
    required String severity,
    required String screenName,
    required String source,
  });
}

class SupportApiClient implements SupportApiClientPort {
  SupportApiClient({
    required this.baseUrl,
    required this.tokenStorage,
    http.Client? httpClient,
  }) : _httpClient = httpClient ?? http.Client();

  final String baseUrl;
  final TokenStorage tokenStorage;
  final http.Client _httpClient;

  @override
  Future<void> submitIssue({
    required String organizationId,
    required String title,
    required String description,
    required String severity,
    required String screenName,
    required String source,
  }) async {
    final (accessToken, _) = await tokenStorage.readTokens();
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception('Unauthenticated');
    }

    final response = await _httpClient.post(
      Uri.parse('$baseUrl/support/tickets'),
      headers: {
        'Authorization': 'Bearer $accessToken',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: jsonEncode({
        'organizationId': organizationId,
        'title': title,
        'description': description,
        'severity': severity,
        'screenName': screenName,
        'source': source,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Support submission failed (${response.statusCode})');
    }
  }
}
