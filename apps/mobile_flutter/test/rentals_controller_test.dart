import 'package:flutter_test/flutter_test.dart';
import 'package:studioos_mobile_flutter/core/api/rentals_api_client.dart';
import 'package:studioos_mobile_flutter/core/offline/offline_action_queue_repository.dart';
import 'package:studioos_mobile_flutter/features/rentals/rentals_controller.dart';
import 'package:studioos_mobile_flutter/generated/studioos_api_client.dart';

class _FakeRentalsApiClient implements RentalsApiClientPort {
  _FakeRentalsApiClient({
    required this.shouldFailStatusUpdate,
    this.failWithConflict = false,
  });

  final bool shouldFailStatusUpdate;
  final bool failWithConflict;
  int updateCalls = 0;

  @override
  Future<Map<String, dynamic>?> createRentalEvidence({
    required String rentalOrderId,
    required String organizationId,
    required String photoUrl,
    required String note,
    required String occurredAt,
    double? latitude,
    double? longitude,
  }) async {
    return {
      'id': 'evidence-1',
      'rentalOrderId': rentalOrderId,
      'organizationId': organizationId,
      'photoUrl': photoUrl,
      'note': note,
      'occurredAt': occurredAt,
    };
  }

  @override
  Future<Map<String, dynamic>?> listRentalEvidence({
    required String rentalOrderId,
    required String organizationId,
    String? cursor,
    int? limit,
  }) async {
    return {'items': <Map<String, dynamic>>[], 'nextCursor': null};
  }

  @override
  Future<List<Map<String, dynamic>>> listRentals({
    required String organizationId,
  }) async {
    return <Map<String, dynamic>>[
      {
        'id': 'rental-1',
        'inventoryItemId': 'item-1',
        'status': 'reserved',
        'startsAt': '2026-01-01T10:00:00.000Z',
        'endsAt': '2026-01-01T12:00:00.000Z',
        'version': '2026-01-01T10:00:00.000Z',
      },
    ];
  }

  @override
  Future<Map<String, dynamic>?> updateRentalStatus({
    required String rentalOrderId,
    required String organizationId,
    required String status,
    String? baseVersion,
    String? operationId,
    String? deviceSessionId,
    String? payloadHash,
    int? retryCount,
  }) async {
    updateCalls += 1;
    if (shouldFailStatusUpdate) {
      if (failWithConflict) {
        throw StudioOsApiException(
          409,
          'Conflict',
          body: {
            'error': {
              'code': 'RENTAL_VERSION_CONFLICT',
              'message': 'Rental order was updated by another actor.',
              'server_version': '2026-01-01T11:00:00.000Z',
              'conflicting_fields': ['status'],
              'last_actor': 'user-2',
              'last_updated_at': '2026-01-01T11:00:00.000Z',
            },
          },
        );
      }
      throw StudioOsApiException(503, 'Server error');
    }
    return {'id': rentalOrderId, 'status': status};
  }
}

class _InMemoryOfflineQueueRepository
    implements OfflineActionQueueRepositoryPort {
  final List<OfflineAction> _actions = <OfflineAction>[];

  @override
  Future<void> clear() async {
    _actions.clear();
  }

  @override
  Future<void> enqueueAction(OfflineAction action) async {
    _actions.add(action);
  }

  @override
  Future<List<OfflineAction>> readActions() async {
    return List<OfflineAction>.from(_actions);
  }

  @override
  Future<void> writeActions(List<OfflineAction> actions) async {
    _actions
      ..clear()
      ..addAll(actions);
  }
}

void main() {
  test('transitionStatus queues offline action when API call fails', () async {
    final queue = _InMemoryOfflineQueueRepository();
    final controller = RentalsController(
      apiClient: _FakeRentalsApiClient(shouldFailStatusUpdate: true),
      offlineQueueRepository: queue,
    );

    await controller.transitionStatus(
      organizationId: 'org-1',
      rentalOrderId: 'rental-1',
      status: 'picked_up',
    );

    final pending = await queue.readActions();
    expect(pending.length, 1);
    expect(pending.first.operationType, 'status');
    expect(controller.state.pendingActionCount, 1);
    expect(controller.state.infoMessage, contains('queued'));
  });

  test(
    'syncPendingActions replays queue and clears successful actions',
    () async {
      final queue = _InMemoryOfflineQueueRepository();
      await queue.enqueueAction(
        OfflineAction(
          operationId: 'status-rental-1-1',
          entityType: 'rental',
          entityId: 'rental-1',
          operationType: 'status',
          organizationId: 'org-1',
          payload: {'status': 'picked_up'},
          payloadHash: 'hash-1',
          localTimestamp: DateTime.now().toUtc(),
        ),
      );

      final apiClient = _FakeRentalsApiClient(shouldFailStatusUpdate: false);
      final controller = RentalsController(
        apiClient: apiClient,
        offlineQueueRepository: queue,
      );

      await controller.syncPendingActions(organizationId: 'org-1');

      final pending = await queue.readActions();
      expect(apiClient.updateCalls, 1);
      expect(pending, isEmpty);
      expect(controller.state.pendingActionCount, 0);
    },
  );

  test('version conflict moves queued action to manual review', () async {
    final queue = _InMemoryOfflineQueueRepository();
    await queue.enqueueAction(
      OfflineAction(
        operationId: 'status-rental-1-2',
        entityType: 'rental',
        entityId: 'rental-1',
        operationType: 'status',
        organizationId: 'org-1',
        payload: {'status': 'returned'},
        payloadHash: 'hash-2',
        localTimestamp: DateTime.now().toUtc(),
        baseVersion: '2026-01-01T10:00:00.000Z',
        deviceSessionId: 'device-1',
      ),
    );

    final controller = RentalsController(
      apiClient: _FakeRentalsApiClient(
        shouldFailStatusUpdate: true,
        failWithConflict: true,
      ),
      offlineQueueRepository: queue,
    );

    await controller.syncPendingActions(organizationId: 'org-1');

    final pending = await queue.readActions();
    expect(pending.length, 1);
    expect(pending.first.syncState, OfflineSyncState.manualReview);
    expect(controller.state.manualReviewCount, 1);
    expect(controller.state.pendingConflicts.length, 1);
  });
}
