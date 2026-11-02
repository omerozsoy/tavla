// Maks Bahis (yüzde bahis) seçenekleri — TÜM SİTEDE TEK KAYNAK. UI 3'erli 2 sıra (3×2 grid)
// gösterir. Potsuz maç YASAK -> min seçenek %10. Backend validasyonu da bu listeyle AYNI olmalı
// (RoomController create/matchmaking + PresenceController invite: in:10,20,30,50,75,100).
export const BET_PCTS = [10, 20, 30, 50, 75, 100] as const
