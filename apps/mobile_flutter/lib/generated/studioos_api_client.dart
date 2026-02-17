// GENERATED FILE. DO NOT EDIT.
// Source: packages/api_contracts_openapi/openapi.yaml
// Endpoints discovered: 42

import 'dart:convert';

import 'package:http/http.dart' as http;

class StudioOsApiException implements Exception {
  StudioOsApiException(this.statusCode, this.message, {this.body});

  final int statusCode;
  final String message;
  final Object? body;

  @override
  String toString() =>
      'StudioOsApiException(statusCode: $statusCode, message: $message)';
}

typedef AccessTokenProvider = Future<String?> Function();

class StudioOsApiClient {
  StudioOsApiClient({
    required this.baseUrl,
    this.accessTokenProvider,
    http.Client? httpClient,
  }) : _httpClient = httpClient ?? http.Client();

  final String baseUrl;
  final AccessTokenProvider? accessTokenProvider;
  final http.Client _httpClient;

  Future<Map<String, dynamic>?> getHealth() async {
    return _request('GET', '/health');
  }

  Future<Map<String, dynamic>?> login({
    required String email,
    required String password,
  }) {
    return _request(
      'POST',
      '/auth/login',
      body: {'email': email, 'password': password},
      includeAuth: false,
    );
  }

  Future<Map<String, dynamic>?> refresh({required String refreshToken}) {
    return _request(
      'POST',
      '/auth/refresh',
      body: {'refreshToken': refreshToken},
      includeAuth: false,
    );
  }

  Future<void> logout({required String refreshToken}) async {
    await _request(
      'POST',
      '/auth/logout',
      body: {'refreshToken': refreshToken},
      includeAuth: false,
    );
  }

  Future<Map<String, dynamic>?> getProfile() {
    return _request('GET', '/auth/profile');
  }

  Future<Map<String, dynamic>?> getClientPortalProbe() {
    return _request('GET', '/rbac-probe/client-portal');
  }

  Future<List<dynamic>> listRentals({required String organizationId}) {
    return _requestList(
      'GET',
      '/rentals',
      query: {'organizationId': organizationId},
    );
  }

  Future<Map<String, dynamic>?> updateRentalStatus({
    required String rentalOrderId,
    required String organizationId,
    required String status,
    String? baseVersion,
    String? operationId,
    String? deviceSessionId,
    String? payloadHash,
    int? retryCount,
  }) {
    return _request(
      'PATCH',
      '/rentals/${Uri.encodeComponent(rentalOrderId)}/status',
      query: {'organizationId': organizationId},
      body: {
        'status': status,
        if (baseVersion != null && baseVersion.isNotEmpty)
          'baseVersion': baseVersion,
        if (operationId != null && operationId.isNotEmpty)
          'operationId': operationId,
        if (deviceSessionId != null && deviceSessionId.isNotEmpty)
          'deviceSessionId': deviceSessionId,
        if (payloadHash != null && payloadHash.isNotEmpty)
          'payloadHash': payloadHash,
        if (retryCount != null) 'retryCount': retryCount,
      },
    );
  }

  Future<Map<String, dynamic>?> createRentalEvidence({
    required String rentalOrderId,
    required String organizationId,
    required String photoUrl,
    required String note,
    required String occurredAt,
    double? latitude,
    double? longitude,
  }) {
    return _request(
      'POST',
      '/rentals/${Uri.encodeComponent(rentalOrderId)}/evidence',
      body: {
        'organizationId': organizationId,
        'photoUrl': photoUrl,
        'note': note,
        'occurredAt': occurredAt,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
      },
    );
  }

  Future<Map<String, dynamic>?> listRentalEvidence({
    required String rentalOrderId,
    required String organizationId,
    String? cursor,
    int? limit,
  }) {
    return _request(
      'GET',
      '/rentals/${Uri.encodeComponent(rentalOrderId)}/evidence',
      query: {
        'organizationId': organizationId,
        if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
        if (limit != null) 'limit': '$limit',
      },
    );
  }

  Future<Map<String, dynamic>?> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
    bool includeAuth = true,
  }) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (includeAuth) {
      final token = await accessTokenProvider?.call();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    late final http.Response response;

    switch (method) {
      case 'GET':
        response = await _httpClient.get(uri, headers: headers);
      case 'POST':
        response = await _httpClient.post(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        );
      case 'PUT':
        response = await _httpClient.put(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        );
      case 'PATCH':
        response = await _httpClient.patch(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        );
      case 'DELETE':
        response = await _httpClient.delete(uri, headers: headers);
      default:
        throw ArgumentError('Unsupported HTTP method: $method');
    }

    return _mapResponse(response);
  }

  Future<List<dynamic>> _requestList(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
    bool includeAuth = true,
  }) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (includeAuth) {
      final token = await accessTokenProvider?.call();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    late final http.Response response;

    switch (method) {
      case 'GET':
        response = await _httpClient.get(uri, headers: headers);
      case 'POST':
        response = await _httpClient.post(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        );
      case 'PUT':
        response = await _httpClient.put(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        );
      case 'PATCH':
        response = await _httpClient.patch(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        );
      case 'DELETE':
        response = await _httpClient.delete(uri, headers: headers);
      default:
        throw ArgumentError('Unsupported HTTP method: $method');
    }

    final statusCode = response.statusCode;
    final hasBody = response.body.trim().isNotEmpty;
    final decodedBody = hasBody ? jsonDecode(response.body) : null;

    if (statusCode >= 200 && statusCode < 300) {
      if (decodedBody is List<dynamic>) {
        return decodedBody;
      }
      return <dynamic>[];
    }

    throw StudioOsApiException(
      statusCode,
      _errorMessageForStatus(statusCode),
      body: decodedBody,
    );
  }

  Map<String, dynamic>? _mapResponse(http.Response response) {
    final statusCode = response.statusCode;
    final hasBody = response.body.trim().isNotEmpty;
    final decodedBody = hasBody ? jsonDecode(response.body) : null;

    if (statusCode >= 200 && statusCode < 300) {
      if (decodedBody is Map<String, dynamic>) {
        return decodedBody;
      }
      return null;
    }

    throw StudioOsApiException(
      statusCode,
      _errorMessageForStatus(statusCode),
      body: decodedBody,
    );
  }

  String _errorMessageForStatus(int statusCode) {
    if (statusCode == 400) {
      return 'Bad request';
    }
    if (statusCode == 401) {
      return 'Unauthorized';
    }
    if (statusCode == 403) {
      return 'Forbidden';
    }
    if (statusCode == 404) {
      return 'Not found';
    }
    if (statusCode >= 500) {
      return 'Server error';
    }
    return 'API request failed';
  }
}
