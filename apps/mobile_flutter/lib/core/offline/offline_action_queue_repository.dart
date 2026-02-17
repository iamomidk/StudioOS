import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

enum OfflineSyncState { pending, synced, failed, manualReview }

class OfflineAction {
  const OfflineAction({
    required this.operationId,
    required this.entityType,
    required this.entityId,
    required this.operationType,
    required this.organizationId,
    required this.payload,
    required this.payloadHash,
    required this.localTimestamp,
    this.baseVersion,
    this.deviceSessionId,
    this.retryCount = 0,
    this.syncState = OfflineSyncState.pending,
    this.nextRetryAt,
    this.lastError,
    this.conflict,
  });

  final String operationId;
  final String entityType;
  final String entityId;
  final String operationType;
  final String organizationId;
  final Map<String, dynamic> payload;
  final String payloadHash;
  final DateTime localTimestamp;
  final String? baseVersion;
  final String? deviceSessionId;
  final int retryCount;
  final OfflineSyncState syncState;
  final DateTime? nextRetryAt;
  final String? lastError;
  final Map<String, dynamic>? conflict;

  OfflineAction copyWith({
    String? baseVersion,
    int? retryCount,
    OfflineSyncState? syncState,
    DateTime? nextRetryAt,
    String? lastError,
    Map<String, dynamic>? conflict,
    bool clearConflict = false,
  }) {
    return OfflineAction(
      operationId: operationId,
      entityType: entityType,
      entityId: entityId,
      operationType: operationType,
      organizationId: organizationId,
      payload: payload,
      payloadHash: payloadHash,
      localTimestamp: localTimestamp,
      baseVersion: baseVersion ?? this.baseVersion,
      deviceSessionId: deviceSessionId,
      retryCount: retryCount ?? this.retryCount,
      syncState: syncState ?? this.syncState,
      nextRetryAt: nextRetryAt ?? this.nextRetryAt,
      lastError: lastError ?? this.lastError,
      conflict: clearConflict ? null : (conflict ?? this.conflict),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'operation_id': operationId,
      'entity_type': entityType,
      'entity_id': entityId,
      'operation_type': operationType,
      'organizationId': organizationId,
      'payload': payload,
      'payload_hash': payloadHash,
      'local_timestamp': localTimestamp.toUtc().toIso8601String(),
      'base_version': baseVersion,
      'device_session_id': deviceSessionId,
      'retry_count': retryCount,
      'sync_state': syncState.name,
      'next_retry_at': nextRetryAt?.toUtc().toIso8601String(),
      'last_error': lastError,
      'conflict': conflict,
    };
  }

  static OfflineAction fromJson(Map<String, dynamic> json) {
    final legacyId =
        json['id']?.toString() ??
        DateTime.now().microsecondsSinceEpoch.toString();
    final legacyType = json['type']?.toString() ?? '';
    final legacyRentalOrderId = json['rentalOrderId']?.toString() ?? '';
    final rawSyncState = json['sync_state']?.toString() ?? 'pending';
    final parsedSyncState = OfflineSyncState.values.firstWhere(
      (state) => state.name == rawSyncState,
      orElse: () => OfflineSyncState.pending,
    );

    return OfflineAction(
      operationId: json['operation_id']?.toString() ?? legacyId,
      entityType: json['entity_type']?.toString() ?? 'rental',
      entityId: json['entity_id']?.toString() ?? legacyRentalOrderId,
      operationType: json['operation_type']?.toString() ?? legacyType,
      organizationId: json['organizationId']?.toString() ?? '',
      payload: (json['payload'] as Map<dynamic, dynamic>? ?? const {}).map(
        (key, value) => MapEntry(key.toString(), value),
      ),
      payloadHash:
          json['payload_hash']?.toString() ??
          '${legacyType}:${legacyRentalOrderId}',
      localTimestamp:
          DateTime.tryParse(
            json['local_timestamp']?.toString() ?? '',
          )?.toUtc() ??
          DateTime.tryParse(json['queuedAt']?.toString() ?? '')?.toUtc() ??
          DateTime.now().toUtc(),
      baseVersion: json['base_version']?.toString(),
      deviceSessionId: json['device_session_id']?.toString(),
      retryCount:
          int.tryParse(json['retry_count']?.toString() ?? '') ??
          int.tryParse(json['retryCount']?.toString() ?? '') ??
          0,
      syncState: parsedSyncState,
      nextRetryAt: DateTime.tryParse(
        json['next_retry_at']?.toString() ?? '',
      )?.toUtc(),
      lastError: json['last_error']?.toString(),
      conflict: (json['conflict'] as Map<dynamic, dynamic>?)?.map(
        (key, value) => MapEntry(key.toString(), value),
      ),
    );
  }
}

abstract class OfflineActionQueueRepositoryPort {
  Future<List<OfflineAction>> readActions();
  Future<void> writeActions(List<OfflineAction> actions);
  Future<void> enqueueAction(OfflineAction action);
  Future<void> clear();
}

class OfflineActionQueueRepository implements OfflineActionQueueRepositoryPort {
  OfflineActionQueueRepository({FlutterSecureStorage? secureStorage})
    : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  static const _queueKey = 'studioos.offline_actions';
  final FlutterSecureStorage _secureStorage;

  @override
  Future<List<OfflineAction>> readActions() async {
    final raw = await _secureStorage.read(key: _queueKey);
    if (raw == null || raw.trim().isEmpty) {
      return const <OfflineAction>[];
    }

    final decoded = jsonDecode(raw);
    if (decoded is! List<dynamic>) {
      return const <OfflineAction>[];
    }

    return decoded
        .whereType<Map<dynamic, dynamic>>()
        .map(
          (row) => OfflineAction.fromJson(
            row.map((key, value) => MapEntry(key.toString(), value)),
          ),
        )
        .toList();
  }

  @override
  Future<void> writeActions(List<OfflineAction> actions) {
    final serialized = jsonEncode(
      actions.map((action) => action.toJson()).toList(),
    );
    return _secureStorage.write(key: _queueKey, value: serialized);
  }

  @override
  Future<void> enqueueAction(OfflineAction action) async {
    final actions = await readActions();
    await writeActions([...actions, action]);
  }

  @override
  Future<void> clear() {
    return _secureStorage.delete(key: _queueKey);
  }
}
