import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/providers.dart';
import '../../core/config/app_env.dart';
import 'rentals_state.dart';

class RentalsFieldScreen extends ConsumerStatefulWidget {
  const RentalsFieldScreen({super.key});

  @override
  ConsumerState<RentalsFieldScreen> createState() => _RentalsFieldScreenState();
}

class _RentalsFieldScreenState extends ConsumerState<RentalsFieldScreen> {
  late final TextEditingController _organizationIdController;
  final Map<String, TextEditingController> _photoControllers = {};
  final Map<String, TextEditingController> _noteControllers = {};

  @override
  void initState() {
    super.initState();
    _organizationIdController = TextEditingController(
      text: defaultOrganizationId,
    );
    Future<void>.microtask(() async {
      await ref.read(rentalsControllerProvider.notifier).refreshPendingCount();
      await _loadRentals();
    });
  }

  @override
  void dispose() {
    _organizationIdController.dispose();
    for (final controller in _photoControllers.values) {
      controller.dispose();
    }
    for (final controller in _noteControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _loadRentals() async {
    final userId = ref.read(authControllerProvider).profile?['id']?.toString();
    await ref
        .read(rentalsControllerProvider.notifier)
        .loadAssignedRentals(
          organizationId: _organizationIdController.text.trim(),
          userId: userId,
        );
  }

  List<String> _nextStatuses(String status) {
    switch (status) {
      case 'reserved':
        return const ['picked_up', 'cancelled'];
      case 'picked_up':
        return const ['returned', 'incident'];
      case 'incident':
        return const ['returned', 'cancelled'];
      default:
        return const <String>[];
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(rentalsControllerProvider);
    final userId = ref.watch(authControllerProvider).profile?['id']?.toString();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Field Operations'),
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(authControllerProvider.notifier).logout();
            },
            child: const Text('Logout'),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _organizationIdController,
              decoration: const InputDecoration(labelText: 'Organization ID'),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                FilledButton(
                  onPressed: state.isLoading
                      ? null
                      : () async => _loadRentals(),
                  child: const Text('Refresh assigned rentals'),
                ),
                OutlinedButton(
                  onPressed: state.isSyncing
                      ? null
                      : () async {
                          await ref
                              .read(rentalsControllerProvider.notifier)
                              .syncPendingActions(
                                organizationId: _organizationIdController.text
                                    .trim(),
                                userId: userId,
                              );
                        },
                  child: const Text('Retry offline sync'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text('Pending offline actions: ${state.pendingActionCount}'),
            Text('Needs manual review: ${state.manualReviewCount}'),
            if (state.pendingConflicts.isNotEmpty) ...[
              const SizedBox(height: 6),
              const Text('Sync conflicts'),
              ...state.pendingConflicts.map((conflictEntry) {
                final operationId =
                    conflictEntry['operationId']?.toString() ?? '';
                final conflict = conflictEntry['conflict'];
                final conflictMap = conflict is Map<dynamic, dynamic>
                    ? conflict.map(
                        (key, value) => MapEntry(key.toString(), value),
                      )
                    : const <String, dynamic>{};
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Operation ${operationId.length > 10 ? operationId.substring(0, 10) : operationId}',
                        ),
                        Text(
                          conflictMap['message']?.toString() ??
                              'Conflict detected',
                        ),
                        Text(
                          'Server version: ${conflictMap['server_version'] ?? 'unknown'}',
                        ),
                        Wrap(
                          spacing: 8,
                          children: [
                            OutlinedButton(
                              onPressed: () async {
                                await ref
                                    .read(rentalsControllerProvider.notifier)
                                    .resolveConflict(
                                      operationId: operationId,
                                      resolution: 'keep_mine',
                                    );
                              },
                              child: const Text('Keep Mine'),
                            ),
                            OutlinedButton(
                              onPressed: () async {
                                await ref
                                    .read(rentalsControllerProvider.notifier)
                                    .resolveConflict(
                                      operationId: operationId,
                                      resolution: 'keep_server',
                                    );
                              },
                              child: const Text('Keep Server'),
                            ),
                            OutlinedButton(
                              onPressed: () async {
                                await ref
                                    .read(rentalsControllerProvider.notifier)
                                    .resolveConflict(
                                      operationId: operationId,
                                      resolution: 'merge',
                                    );
                              },
                              child: const Text('Merge'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ],
            if (state.infoMessage != null) ...[
              const SizedBox(height: 6),
              Text(
                state.infoMessage!,
                style: const TextStyle(color: Colors.green),
              ),
            ],
            if (state.errorMessage != null) ...[
              const SizedBox(height: 6),
              Text(
                state.errorMessage!,
                style: const TextStyle(color: Colors.red),
              ),
            ],
            const SizedBox(height: 12),
            Expanded(
              child: ListView.builder(
                itemCount: state.rentals.length,
                itemBuilder: (context, index) {
                  final rental = state.rentals[index];
                  final photoController = _photoControllers.putIfAbsent(
                    rental.id,
                    () => TextEditingController(
                      text: 'https://example.com/evidence.jpg',
                    ),
                  );
                  final noteController = _noteControllers.putIfAbsent(
                    rental.id,
                    () => TextEditingController(text: 'Pickup/return evidence'),
                  );
                  final evidenceItems =
                      state.evidenceByRental[rental.id] ??
                      const <RentalEvidenceView>[];

                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Rental ${rental.id.substring(0, rental.id.length >= 8 ? 8 : rental.id.length)}',
                          ),
                          Text('Item: ${rental.inventoryItemId}'),
                          Text('Status: ${rental.status}'),
                          Text(
                            'Window: ${rental.startsAt.toLocal()} -> ${rental.endsAt.toLocal()}',
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            children: [
                              ..._nextStatuses(rental.status).map(
                                (status) => OutlinedButton(
                                  onPressed: () async {
                                    await ref
                                        .read(
                                          rentalsControllerProvider.notifier,
                                        )
                                        .transitionStatus(
                                          organizationId:
                                              _organizationIdController.text
                                                  .trim(),
                                          rentalOrderId: rental.id,
                                          status: status,
                                          userId: userId,
                                        );
                                  },
                                  child: Text('Mark $status'),
                                ),
                              ),
                              TextButton(
                                onPressed: () async {
                                  await ref
                                      .read(rentalsControllerProvider.notifier)
                                      .loadEvidence(
                                        organizationId:
                                            _organizationIdController.text
                                                .trim(),
                                        rentalOrderId: rental.id,
                                      );
                                },
                                child: const Text('Load evidence'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: photoController,
                            decoration: const InputDecoration(
                              labelText: 'Evidence photo URL',
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: noteController,
                            decoration: const InputDecoration(
                              labelText: 'Evidence note',
                            ),
                          ),
                          const SizedBox(height: 8),
                          FilledButton.tonal(
                            onPressed: () async {
                              await ref
                                  .read(rentalsControllerProvider.notifier)
                                  .appendEvidence(
                                    organizationId: _organizationIdController
                                        .text
                                        .trim(),
                                    rentalOrderId: rental.id,
                                    photoUrl: photoController.text.trim(),
                                    note: noteController.text.trim(),
                                  );
                            },
                            child: const Text('Capture evidence'),
                          ),
                          if (evidenceItems.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            const Text('Evidence timeline:'),
                            ...evidenceItems.map(
                              (entry) => Text(
                                '- ${entry.occurredAt.toLocal()} ${entry.note} (${entry.photoUrl})',
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
