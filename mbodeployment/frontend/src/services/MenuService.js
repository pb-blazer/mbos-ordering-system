
import { supabase } from './SupabaseClient';

const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? `http://${window.location.hostname}:3000` : '');

export async function getMenu() {
    const response = await fetch(`${API_BASE_URL}/api/menu`);

    if (!response.ok) {
        let message = `Failed to load menu (${response.status})`;

        try {
            const data = await response.json();
            message = data?.error || data?.message || message;
        } catch {
            // Response was not JSON.
        }

        throw new Error(message);
    }

    return response.json();
}

export function subscribeToMenuChanges(callback) {
    const channel = supabase
        .channel('mbos-public-menu-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'menu_items',
            },
            (payload) => {
                callback(payload);
            }
        )
        .subscribe((status) => {
            if (
                status === 'CHANNEL_ERROR' ||
                status === 'TIMED_OUT'
            ) {
                console.error(
                    'Menu Realtime subscription issue:',
                    status
                );
            }
        });

    return () => {
        supabase.removeChannel(channel);
    };
}
