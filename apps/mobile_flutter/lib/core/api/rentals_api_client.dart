import '../../generated/studioos_api_client.dart';

abstract class RentalsApiClientPort {
  Future<List<Map<String, dynamic>>> listRentals({
    required String organizationId,
  });
  Future<Map<String, dynamic>?> updateRentalStatus({
    required String rentalOrderId,
    required String organizationId,
    required String status,
  });
  Future<Map<String, dynamic>?> createRentalEvidence({
    required String rentalOrderId,
    required String organizationId,
    required String photoUrl,
    required String note,
    required String occurredAt,
    double? latitude,
    double? longitude,
  });
  Future<Map<String, dynamic>?> listRentalEvidence({
    required String rentalOrderId,
    required String organizationId,
    String? cursor,
    int? limit,
  });
}

class RentalsApiClient implements RentalsApiClientPort {
  RentalsApiClient(this._client);

  final StudioOsApiClient _client;

  @override
  Future<List<Map<String, dynamic>>> listRentals({
    required String organizationId,
  }) async {
    final response = await _client.listRentals(organizationId: organizationId);
    return response
        .whereType<Map<dynamic, dynamic>>()
        .map((row) => row.map((key, value) => MapEntry(key.toString(), value)))
        .toList();
  }

  @override
  Future<Map<String, dynamic>?> updateRentalStatus({
    required String rentalOrderId,
    required String organizationId,
    required String status,
  }) {
    return _client.updateRentalStatus(
      rentalOrderId: rentalOrderId,
      organizationId: organizationId,
      status: status,
    );
  }

  @override
  Future<Map<String, dynamic>?> createRentalEvidence({
    required String rentalOrderId,
    required String organizationId,
    required String photoUrl,
    required String note,
    required String occurredAt,
    double? latitude,
    double? longitude,
  }) {
    return _client.createRentalEvidence(
      rentalOrderId: rentalOrderId,
      organizationId: organizationId,
      photoUrl: photoUrl,
      note: note,
      occurredAt: occurredAt,
      latitude: latitude,
      longitude: longitude,
    );
  }

  @override
  Future<Map<String, dynamic>?> listRentalEvidence({
    required String rentalOrderId,
    required String organizationId,
    String? cursor,
    int? limit,
  }) {
    return _client.listRentalEvidence(
      rentalOrderId: rentalOrderId,
      organizationId: organizationId,
      cursor: cursor,
      limit: limit,
    );
  }
}
