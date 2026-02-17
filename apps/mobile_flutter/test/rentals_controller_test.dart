import 'package:flutter_test/flutter_test.dart';
import 'package:studioos_mobile_flutter/core/api/rentals_api_client.dart';
import 'package:studioos_mobile_flutter/core/offline/offline_action_queue_repository.dart';
import 'package:studioos_mobile_flutter/features/rentals/rentals_controller.dart';
import 'package:studioos_mobile_flutter/generated/studioos_api_client.dart';

class _FakeRentalsApiClient implements RentalsApiClientPort {
  _FakeRentalsApiClient({required this.shouldFailStatusUpdate});

  final bool shouldFailStatusUpdate;
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
      },
    ];
  }

  @override
  Future<Map<String, dynamic>?> updateRentalStatus({
    required String rentalOrderId,
    required String organizationId,
    required String status,
  }) async {
    updateCalls += 1;
    if (shouldFailStatusUpdate) {
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
    expect(controller.state.pendingActionCount, 1);
    expect(controller.state.infoMessage, contains('queued'));
  });

  test(
    'syncPendingActions replays queue and clears successful actions',
    () async {
      final queue = _InMemoryOfflineQueueRepository();
      await queue.enqueueAction(
        OfflineAction(
          id: '1',
          type: 'status',
          rentalOrderId: 'rental-1',
          organizationId: 'org-1',
          payload: {'status': 'picked_up'},
          queuedAt: DateTime.now().toUtc(),
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
}
