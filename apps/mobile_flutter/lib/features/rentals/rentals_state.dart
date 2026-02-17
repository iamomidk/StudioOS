class RentalOrderView {
  const RentalOrderView({
    required this.id,
    required this.inventoryItemId,
    required this.status,
    required this.startsAt,
    required this.endsAt,
    required this.version,
    this.assignedUserId,
  });

  final String id;
  final String inventoryItemId;
  final String status;
  final DateTime startsAt;
  final DateTime endsAt;
  final String version;
  final String? assignedUserId;

  static RentalOrderView fromJson(Map<String, dynamic> json) {
    return RentalOrderView(
      id: json['id']?.toString() ?? '',
      inventoryItemId: json['inventoryItemId']?.toString() ?? '',
      status: json['status']?.toString() ?? 'reserved',
      startsAt:
          DateTime.tryParse(json['startsAt']?.toString() ?? '')?.toUtc() ??
          DateTime.now().toUtc(),
      endsAt:
          DateTime.tryParse(json['endsAt']?.toString() ?? '')?.toUtc() ??
          DateTime.now().toUtc(),
      version: json['version']?.toString() ?? '',
      assignedUserId: json['assignedUserId']?.toString(),
    );
  }
}

class RentalEvidenceView {
  const RentalEvidenceView({
    required this.id,
    required this.note,
    required this.photoUrl,
    required this.occurredAt,
  });

  final String id;
  final String note;
  final String photoUrl;
  final DateTime occurredAt;

  static RentalEvidenceView fromJson(Map<String, dynamic> json) {
    return RentalEvidenceView(
      id: json['id']?.toString() ?? '',
      note: json['note']?.toString() ?? '',
      photoUrl: json['photoUrl']?.toString() ?? '',
      occurredAt:
          DateTime.tryParse(json['occurredAt']?.toString() ?? '')?.toUtc() ??
          DateTime.now().toUtc(),
    );
  }
}

class RentalsState {
  const RentalsState({
    required this.isLoading,
    required this.isSyncing,
    required this.rentals,
    required this.evidenceByRental,
    required this.pendingActionCount,
    required this.manualReviewCount,
    required this.pendingConflicts,
    this.errorMessage,
    this.infoMessage,
  });

  final bool isLoading;
  final bool isSyncing;
  final List<RentalOrderView> rentals;
  final Map<String, List<RentalEvidenceView>> evidenceByRental;
  final int pendingActionCount;
  final int manualReviewCount;
  final List<Map<String, dynamic>> pendingConflicts;
  final String? errorMessage;
  final String? infoMessage;

  RentalsState copyWith({
    bool? isLoading,
    bool? isSyncing,
    List<RentalOrderView>? rentals,
    Map<String, List<RentalEvidenceView>>? evidenceByRental,
    int? pendingActionCount,
    int? manualReviewCount,
    List<Map<String, dynamic>>? pendingConflicts,
    String? errorMessage,
    String? infoMessage,
    bool clearError = false,
    bool clearInfo = false,
  }) {
    return RentalsState(
      isLoading: isLoading ?? this.isLoading,
      isSyncing: isSyncing ?? this.isSyncing,
      rentals: rentals ?? this.rentals,
      evidenceByRental: evidenceByRental ?? this.evidenceByRental,
      pendingActionCount: pendingActionCount ?? this.pendingActionCount,
      manualReviewCount: manualReviewCount ?? this.manualReviewCount,
      pendingConflicts: pendingConflicts ?? this.pendingConflicts,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      infoMessage: clearInfo ? null : (infoMessage ?? this.infoMessage),
    );
  }

  static const initial = RentalsState(
    isLoading: false,
    isSyncing: false,
    rentals: <RentalOrderView>[],
    evidenceByRental: <String, List<RentalEvidenceView>>{},
    pendingActionCount: 0,
    manualReviewCount: 0,
    pendingConflicts: <Map<String, dynamic>>[],
  );
}
