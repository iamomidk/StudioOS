import 'dart:convert';

import 'package:riverpod/riverpod.dart';

import '../../core/api/rentals_api_client.dart';
import '../../core/offline/offline_action_queue_repository.dart';
import '../../generated/studioos_api_client.dart';
import 'rentals_state.dart';

class RentalsController extends StateNotifier<RentalsState> {
  RentalsController({
    required RentalsApiClientPort apiClient,
    required OfflineActionQueueRepositoryPort offlineQueueRepository,
  }) : _apiClient = apiClient,
       _offlineQueueRepository = offlineQueueRepository,
       _deviceSessionId = _newDeviceSessionId(),
       super(RentalsState.initial);

  static const _maxRetryCount = 4;

  final RentalsApiClientPort _apiClient;
  final OfflineActionQueueRepositoryPort _offlineQueueRepository;
  final String _deviceSessionId;

  static String _newDeviceSessionId() {
    final now = DateTime.now().toUtc().microsecondsSinceEpoch;
    return 'device-$now';
  }

  String _newOperationId(String operationType, String entityId) {
    final now = DateTime.now().toUtc().microsecondsSinceEpoch;
    return '$operationType-$entityId-$now';
  }

  String _payloadHash(
    String operationType,
    String entityId,
    Map<String, dynamic> payload,
  ) {
    final encoded = jsonEncode({
      'operationType': operationType,
      'entityId': entityId,
      'payload': payload,
    });
    return base64Url.encode(utf8.encode(encoded));
  }

  int _backoffSeconds(int retryCount) {
    if (retryCount <= 0) {
      return 1;
    }
    final bounded = retryCount > 6 ? 6 : retryCount;
    return 1 << bounded;
  }

  Future<void> refreshPendingCount() async {
    final all = await _offlineQueueRepository.readActions();
    final pending = all
        .where((action) => action.syncState != OfflineSyncState.synced)
        .toList();
    final manualReview = pending
        .where((action) => action.syncState == OfflineSyncState.manualReview)
        .toList();

    state = state.copyWith(
      pendingActionCount: pending.length,
      manualReviewCount: manualReview.length,
      pendingConflicts: manualReview
          .where((action) => action.conflict != null)
          .map(
            (action) => {
              'operationId': action.operationId,
              'entityType': action.entityType,
              'entityId': action.entityId,
              'operationType': action.operationType,
              'conflict': action.conflict,
              'retryCount': action.retryCount,
            },
          )
          .toList(),
    );
  }

  Future<void> loadAssignedRentals({
    required String organizationId,
    String? userId,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true, clearInfo: true);
    try {
      final rentals = await _apiClient.listRentals(
        organizationId: organizationId,
      );
      final mapped = rentals.map(RentalOrderView.fromJson).where((order) {
        if (userId == null || userId.trim().isEmpty) {
          return true;
        }
        return order.assignedUserId == null || order.assignedUserId == userId;
      }).toList();

      await refreshPendingCount();
      state = state.copyWith(
        isLoading: false,
        rentals: mapped,
        clearError: true,
      );
    } on StudioOsApiException catch (error) {
      await refreshPendingCount();
      state = state.copyWith(isLoading: false, errorMessage: error.message);
    }
  }

  Future<void> loadEvidence({
    required String organizationId,
    required String rentalOrderId,
  }) async {
    try {
      final response = await _apiClient.listRentalEvidence(
        rentalOrderId: rentalOrderId,
        organizationId: organizationId,
      );
      final items = (response?['items'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<dynamic, dynamic>>()
          .map(
            (entry) => RentalEvidenceView.fromJson(
              entry.map((key, value) => MapEntry(key.toString(), value)),
            ),
          )
          .toList();

      state = state.copyWith(
        evidenceByRental: {...state.evidenceByRental, rentalOrderId: items},
        clearError: true,
      );
    } on StudioOsApiException catch (error) {
      state = state.copyWith(errorMessage: error.message);
    }
  }

  Future<void> transitionStatus({
    required String organizationId,
    required String rentalOrderId,
    required String status,
    String? userId,
  }) async {
    RentalOrderView? rental;
    for (final item in state.rentals) {
      if (item.id == rentalOrderId) {
        rental = item;
        break;
      }
    }
    final baseVersion = rental?.version;

    try {
      await _apiClient.updateRentalStatus(
        rentalOrderId: rentalOrderId,
        organizationId: organizationId,
        status: status,
        baseVersion: baseVersion,
      );
      await loadAssignedRentals(organizationId: organizationId, userId: userId);
      state = state.copyWith(
        infoMessage: 'Status updated to $status',
        clearError: true,
      );
    } on StudioOsApiException {
      final payload = {'status': status};
      final queuedAction = OfflineAction(
        operationId: _newOperationId('status', rentalOrderId),
        entityType: 'rental',
        entityId: rentalOrderId,
        operationType: 'status',
        organizationId: organizationId,
        payload: payload,
        payloadHash: _payloadHash('status', rentalOrderId, payload),
        localTimestamp: DateTime.now().toUtc(),
        baseVersion: baseVersion,
        deviceSessionId: _deviceSessionId,
      );
      await _offlineQueueRepository.enqueueAction(queuedAction);
      await refreshPendingCount();
      state = state.copyWith(
        infoMessage: 'Offline: status change queued for sync.',
        clearError: true,
      );
    }
  }

  Future<void> appendEvidence({
    required String organizationId,
    required String rentalOrderId,
    required String photoUrl,
    required String note,
  }) async {
    final occurredAt = DateTime.now().toUtc().toIso8601String();

    try {
      await _apiClient.createRentalEvidence(
        rentalOrderId: rentalOrderId,
        organizationId: organizationId,
        photoUrl: photoUrl,
        note: note,
        occurredAt: occurredAt,
      );
      await loadEvidence(
        organizationId: organizationId,
        rentalOrderId: rentalOrderId,
      );
      state = state.copyWith(
        infoMessage: 'Evidence uploaded.',
        clearError: true,
      );
    } on StudioOsApiException {
      final payload = {
        'photoUrl': photoUrl,
        'note': note,
        'occurredAt': occurredAt,
      };
      final queuedAction = OfflineAction(
        operationId: _newOperationId('evidence', rentalOrderId),
        entityType: 'rental_evidence',
        entityId: rentalOrderId,
        operationType: 'evidence',
        organizationId: organizationId,
        payload: payload,
        payloadHash: _payloadHash('evidence', rentalOrderId, payload),
        localTimestamp: DateTime.now().toUtc(),
        baseVersion: null,
        deviceSessionId: _deviceSessionId,
      );
      await _offlineQueueRepository.enqueueAction(queuedAction);
      await refreshPendingCount();
      state = state.copyWith(
        infoMessage: 'Offline: evidence queued for sync.',
        clearError: true,
      );
    }
  }

  Future<void> resolveConflict({
    required String operationId,
    required String resolution,
  }) async {
    final queue = await _offlineQueueRepository.readActions();
    final updated = <OfflineAction>[];

    for (final action in queue) {
      if (action.operationId != operationId) {
        updated.add(action);
        continue;
      }

      final conflict = action.conflict ?? const <String, dynamic>{};
      final serverVersion = conflict['server_version']?.toString();

      if (resolution == 'keep_server') {
        continue;
      }

      if (resolution == 'merge') {
        final mergedPayload = <String, dynamic>{
          ...action.payload,
          'note': '${action.payload['note'] ?? ''} [merged-local]',
        };
        updated.add(
          action.copyWith(
            baseVersion: serverVersion,
            retryCount: 0,
            syncState: OfflineSyncState.pending,
            nextRetryAt: null,
            conflict: {...conflict, 'resolution_preview': mergedPayload},
            clearConflict: false,
          ),
        );
        continue;
      }

      updated.add(
        action.copyWith(
          baseVersion: serverVersion,
          retryCount: 0,
          syncState: OfflineSyncState.pending,
          nextRetryAt: null,
          clearConflict: true,
        ),
      );
    }

    await _offlineQueueRepository.writeActions(updated);
    await refreshPendingCount();
    state = state.copyWith(
      infoMessage: 'Conflict resolution queued: $resolution',
      clearError: true,
    );
  }

  Future<void> syncPendingActions({
    required String organizationId,
    String? userId,
  }) async {
    state = state.copyWith(isSyncing: true, clearError: true, clearInfo: true);

    final pending = await _offlineQueueRepository.readActions();
    final remaining = <OfflineAction>[];
    final now = DateTime.now().toUtc();

    for (final action in pending) {
      if (action.syncState == OfflineSyncState.manualReview) {
        remaining.add(action);
        continue;
      }
      if (action.nextRetryAt != null && action.nextRetryAt!.isAfter(now)) {
        remaining.add(action);
        continue;
      }

      try {
        if (action.operationType == 'status') {
          await _apiClient.updateRentalStatus(
            rentalOrderId: action.entityId,
            organizationId: action.organizationId,
            status: action.payload['status']?.toString() ?? 'reserved',
            baseVersion: action.baseVersion,
            operationId: action.operationId,
            deviceSessionId: action.deviceSessionId,
            payloadHash: action.payloadHash,
            retryCount: action.retryCount,
          );
        } else if (action.operationType == 'evidence') {
          await _apiClient.createRentalEvidence(
            rentalOrderId: action.entityId,
            organizationId: action.organizationId,
            photoUrl: action.payload['photoUrl']?.toString() ?? '',
            note: action.payload['note']?.toString() ?? '',
            occurredAt:
                action.payload['occurredAt']?.toString() ??
                DateTime.now().toUtc().toIso8601String(),
          );
        }
      } on StudioOsApiException catch (error) {
        remaining.add(_nextFailedAction(action, error));
      }
    }

    await _offlineQueueRepository.writeActions(remaining);
    await refreshPendingCount();
    await loadAssignedRentals(organizationId: organizationId, userId: userId);

    state = state.copyWith(
      isSyncing: false,
      infoMessage: remaining.isEmpty
          ? 'Offline actions synced.'
          : 'Some actions require retry or manual review.',
      clearError: true,
    );
  }

  OfflineAction _nextFailedAction(
    OfflineAction action,
    StudioOsApiException error,
  ) {
    final errorBody = (error.body is Map<dynamic, dynamic>)
        ? (error.body as Map<dynamic, dynamic>).map(
            (key, value) => MapEntry(key.toString(), value),
          )
        : const <String, dynamic>{};
    final nestedError = (errorBody['error'] is Map<dynamic, dynamic>)
        ? (errorBody['error'] as Map<dynamic, dynamic>).map(
            (key, value) => MapEntry(key.toString(), value),
          )
        : const <String, dynamic>{};
    final conflictCode = nestedError['code']?.toString();

    if (error.statusCode == 409 && conflictCode == 'RENTAL_VERSION_CONFLICT') {
      return action.copyWith(
        syncState: OfflineSyncState.manualReview,
        retryCount: action.retryCount + 1,
        lastError: nestedError['message']?.toString() ?? error.message,
        conflict: nestedError,
      );
    }

    final nextRetry = action.retryCount + 1;
    if (nextRetry >= _maxRetryCount) {
      return action.copyWith(
        syncState: OfflineSyncState.manualReview,
        retryCount: nextRetry,
        lastError: error.message,
      );
    }

    return action.copyWith(
      syncState: OfflineSyncState.failed,
      retryCount: nextRetry,
      nextRetryAt: DateTime.now().toUtc().add(
        Duration(seconds: _backoffSeconds(nextRetry)),
      ),
      lastError: error.message,
    );
  }
}
