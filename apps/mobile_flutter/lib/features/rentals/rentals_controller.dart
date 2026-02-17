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
       super(RentalsState.initial);

  final RentalsApiClientPort _apiClient;
  final OfflineActionQueueRepositoryPort _offlineQueueRepository;

  Future<void> refreshPendingCount() async {
    final pending = await _offlineQueueRepository.readActions();
    state = state.copyWith(pendingActionCount: pending.length);
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
    try {
      await _apiClient.updateRentalStatus(
        rentalOrderId: rentalOrderId,
        organizationId: organizationId,
        status: status,
      );
      await loadAssignedRentals(organizationId: organizationId, userId: userId);
      state = state.copyWith(
        infoMessage: 'Status updated to $status',
        clearError: true,
      );
    } on StudioOsApiException {
      final queuedAction = OfflineAction(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        type: 'status',
        rentalOrderId: rentalOrderId,
        organizationId: organizationId,
        payload: {'status': status},
        queuedAt: DateTime.now().toUtc(),
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
      final queuedAction = OfflineAction(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        type: 'evidence',
        rentalOrderId: rentalOrderId,
        organizationId: organizationId,
        payload: {'photoUrl': photoUrl, 'note': note, 'occurredAt': occurredAt},
        queuedAt: DateTime.now().toUtc(),
      );
      await _offlineQueueRepository.enqueueAction(queuedAction);
      await refreshPendingCount();
      state = state.copyWith(
        infoMessage: 'Offline: evidence queued for sync.',
        clearError: true,
      );
    }
  }

  Future<void> syncPendingActions({
    required String organizationId,
    String? userId,
  }) async {
    state = state.copyWith(isSyncing: true, clearError: true, clearInfo: true);

    final pending = await _offlineQueueRepository.readActions();
    final remaining = <OfflineAction>[];

    for (final action in pending) {
      try {
        if (action.type == 'status') {
          await _apiClient.updateRentalStatus(
            rentalOrderId: action.rentalOrderId,
            organizationId: action.organizationId,
            status: action.payload['status']?.toString() ?? 'reserved',
          );
        } else if (action.type == 'evidence') {
          await _apiClient.createRentalEvidence(
            rentalOrderId: action.rentalOrderId,
            organizationId: action.organizationId,
            photoUrl: action.payload['photoUrl']?.toString() ?? '',
            note: action.payload['note']?.toString() ?? '',
            occurredAt:
                action.payload['occurredAt']?.toString() ??
                DateTime.now().toUtc().toIso8601String(),
          );
        }
      } on StudioOsApiException {
        remaining.add(action);
      }
    }

    await _offlineQueueRepository.writeActions(remaining);
    await refreshPendingCount();
    await loadAssignedRentals(organizationId: organizationId, userId: userId);

    state = state.copyWith(
      isSyncing: false,
      infoMessage: remaining.isEmpty
          ? 'Offline actions synced.'
          : 'Some actions remain queued.',
      clearError: true,
    );
  }
}
