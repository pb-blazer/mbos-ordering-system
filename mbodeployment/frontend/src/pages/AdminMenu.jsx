import {
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    getStaffSession,
} from '../services/AdminAuthService';

import {
    getAdminMenu,
    createAdminMenuItem,
    updateAdminMenuItem,
    archiveAdminMenuItem,
    restoreAdminMenuItem,
} from '../services/AdminMenuService';

import './AdminMenu.css';

// ==========================================================
// HELPERS
// ==========================================================

const EMPTY_FORM = {
    name: '',
    category: '',
    price: '',
    description: '',
};

function formatMoney(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return 'R0.00';
    }

    return `R${amount.toFixed(2)}`;
}

function validateMenuForm(form) {
    if (!form.name.trim()) {
        return 'Enter a menu item name.';
    }

    if (form.name.trim().length > 100) {
        return 'Menu item name cannot exceed 100 characters.';
    }

    if (!form.category.trim()) {
        return 'Enter a menu category.';
    }

    if (form.category.trim().length > 100) {
        return 'Category cannot exceed 100 characters.';
    }

    if (form.price === '') {
        return 'Enter a menu item price.';
    }

    const price = Number(form.price);

    if (
        !Number.isFinite(price) ||
        price < 0 ||
        price > 100000
    ) {
        return 'Enter a valid price between R0 and R100,000.';
    }

    if (
        Math.round(price * 100) / 100 !== price
    ) {
        return 'Price cannot have more than two decimal places.';
    }

    if (form.description.length > 1000) {
        return 'Description cannot exceed 1000 characters.';
    }

    return '';
}

// ==========================================================
// ADMIN MENU
// ==========================================================

function AdminMenu() {
    const [menu, setMenu] = useState([]);

    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);

    const [pageError, setPageError] = useState('');
    const [saveMessage, setSaveMessage] = useState('');

    const [editingId, setEditingId] = useState(null);
    const [showCreateForm, setShowCreateForm] = useState(false);

    const [view, setView] = useState('active');

    const [editForm, setEditForm] = useState({
        ...EMPTY_FORM,
    });

    const [newForm, setNewForm] = useState({
        ...EMPTY_FORM,
    });

    // ======================================================
    // MENU COUNTS
    // ======================================================

    const activeMenu = useMemo(
        () => menu.filter((item) => item.is_listed !== false),
        [menu]
    );

    const archivedMenu = useMemo(
        () => menu.filter((item) => item.is_listed === false),
        [menu]
    );

    const displayedMenu =
        view === 'archived'
            ? archivedMenu
            : activeMenu;

    // ======================================================
    // AUTHENTICATION + INITIAL LOAD
    // ======================================================

    useEffect(() => {
        let mounted = true;

        const initialize = async () => {
            try {
                const session = await getStaffSession();

                if (!session) {
                    window.location.replace('/admin/login');
                    return;
                }

                const nextMenu = await getAdminMenu();

                if (mounted) {
                    setMenu(nextMenu);
                    setPageError('');
                }
            } catch (error) {
                console.error(
                    'Admin menu load failed:',
                    error
                );

                if (mounted) {
                    if (
                        error.message?.includes('session') ||
                        error.message?.includes('Session')
                    ) {
                        window.location.replace('/admin/login');
                        return;
                    }

                    setPageError(
                        error.message ||
                            'Unable to load menu.'
                    );
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        initialize();

        return () => {
            mounted = false;
        };
    }, []);

    // ======================================================
    // FORM HELPERS
    // ======================================================

    const handleEditFormChange = (event) => {
        const { name, value } = event.target;

        setEditForm((current) => ({
            ...current,
            [name]: value,
        }));
    };

    const handleNewFormChange = (event) => {
        const { name, value } = event.target;

        setNewForm((current) => ({
            ...current,
            [name]: value,
        }));
    };

    // ======================================================
    // OPEN CREATE FORM
    // ======================================================

    const openCreateForm = () => {
        setEditingId(null);
        setEditForm({ ...EMPTY_FORM });
        setNewForm({ ...EMPTY_FORM });

        setPageError('');
        setSaveMessage('');

        setShowCreateForm(true);
    };

    const closeCreateForm = () => {
        setShowCreateForm(false);
        setNewForm({ ...EMPTY_FORM });
        setPageError('');
    };

    // ======================================================
    // CREATE NEW MENU ITEM
    // ======================================================

    const createItem = async (event) => {
        event.preventDefault();

        const validationError = validateMenuForm(newForm);

        if (validationError) {
            setPageError(validationError);
            return;
        }

        setSavingId('new');
        setPageError('');
        setSaveMessage('');

        try {
            const createdItem = await createAdminMenuItem({
                name: newForm.name.trim(),
                category: newForm.category.trim(),
                price: Number(newForm.price),
                description: newForm.description.trim(),
            });

            setMenu((currentMenu) => [
                createdItem,
                ...currentMenu,
            ]);

            setNewForm({ ...EMPTY_FORM });
            setShowCreateForm(false);

            setView('active');

            setSaveMessage(
                `${createdItem.name.toUpperCase()} ADDED TO MENU`
            );
        } catch (error) {
            console.error(
                'Create menu item failed:',
                error
            );

            setPageError(
                error.message ||
                    'Unable to create menu item.'
            );
        } finally {
            setSavingId(null);
        }
    };

    // ======================================================
    // START EDITING
    // ======================================================

    const startEditing = (item) => {
        setSaveMessage('');
        setPageError('');

        setShowCreateForm(false);

        setEditingId(item.id);

        setEditForm({
            name: item.name || '',
            category: item.category || '',
            price: item.price ?? '',
            description: item.description || '',
        });
    };

    // ======================================================
    // CANCEL EDITING
    // ======================================================

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({ ...EMPTY_FORM });
        setPageError('');
    };

    // ======================================================
    // SAVE ITEM
    // ======================================================

    const saveItem = async (itemId) => {
        const validationError = validateMenuForm(editForm);

        if (validationError) {
            setPageError(validationError);
            return;
        }

        setSavingId(itemId);
        setPageError('');
        setSaveMessage('');

        try {
            const updatedItem = await updateAdminMenuItem(
                itemId,
                {
                    name: editForm.name.trim(),
                    category: editForm.category.trim(),
                    price: Number(editForm.price),
                    description: editForm.description.trim(),
                }
            );

            setMenu((currentMenu) =>
                currentMenu.map((item) =>
                    item.id === itemId
                        ? updatedItem
                        : item
                )
            );

            setEditingId(null);
            setEditForm({ ...EMPTY_FORM });

            setSaveMessage('MENU ITEM UPDATED');
        } catch (error) {
            console.error(
                'Admin menu item update failed:',
                error
            );

            setPageError(
                error.message ||
                    'Unable to update menu item.'
            );
        } finally {
            setSavingId(null);
        }
    };

    // ======================================================
    // TOGGLE AVAILABILITY
    // ======================================================

    const toggleAvailability = async (item) => {
        setSavingId(item.id);

        setPageError('');
        setSaveMessage('');

        try {
            const updatedItem = await updateAdminMenuItem(
                item.id,
                {
                    available: !item.available,
                }
            );

            setMenu((currentMenu) =>
                currentMenu.map((currentItem) =>
                    currentItem.id === item.id
                        ? updatedItem
                        : currentItem
                )
            );

            setSaveMessage(
                updatedItem.available
                    ? `${updatedItem.name.toUpperCase()} IS AVAILABLE`
                    : `${updatedItem.name.toUpperCase()} MARKED SOLD OUT`
            );
        } catch (error) {
            console.error(
                'Menu availability update failed:',
                error
            );

            setPageError(
                error.message ||
                    'Unable to update availability.'
            );
        } finally {
            setSavingId(null);
        }
    };

    // ======================================================
    // ARCHIVE / REMOVE ITEM
    // ======================================================

    const archiveItem = async (item) => {
        const confirmed = window.confirm(
            `Remove "${item.name}" from the customer-facing menu?\n\nThe item will be archived, not permanently deleted. Existing orders will remain intact.`
        );

        if (!confirmed) {
            return;
        }

        setSavingId(item.id);
        setPageError('');
        setSaveMessage('');

        try {
            const updatedItem = await archiveAdminMenuItem(
                item.id
            );

            setMenu((currentMenu) =>
                currentMenu.map((currentItem) =>
                    currentItem.id === item.id
                        ? updatedItem
                        : currentItem
                )
            );

            setSaveMessage(
                `${item.name.toUpperCase()} ARCHIVED`
            );
        } catch (error) {
            console.error(
                'Menu archive failed:',
                error
            );

            setPageError(
                error.message ||
                    'Unable to archive menu item.'
            );
        } finally {
            setSavingId(null);
        }
    };

    // ======================================================
    // RESTORE ARCHIVED ITEM
    // ======================================================

    const restoreItem = async (item) => {
        setSavingId(item.id);
        setPageError('');
        setSaveMessage('');

        try {
            const updatedItem = await restoreAdminMenuItem(
                item.id
            );

            setMenu((currentMenu) =>
                currentMenu.map((currentItem) =>
                    currentItem.id === item.id
                        ? updatedItem
                        : currentItem
                )
            );

            setSaveMessage(
                `${item.name.toUpperCase()} RESTORED TO MENU`
            );
        } catch (error) {
            console.error(
                'Menu restore failed:',
                error
            );

            setPageError(
                error.message ||
                    'Unable to restore menu item.'
            );
        } finally {
            setSavingId(null);
        }
    };

    // ======================================================
    // LOADING SCREEN
    // ======================================================

    if (loading) {
        return (
            <main className="admin-menu-page">
                <div className="admin-menu-loading">
                    <div className="admin-menu-spinner" />

                    <p>
                        LOADING MENU CONTROL
                    </p>
                </div>
            </main>
        );
    }

    // ======================================================
    // PAGE
    // ======================================================

    return (
        <main className="admin-menu-page">

            {/* HEADER */}

            <header className="admin-menu-header">
                <div className="admin-menu-brand">
                    <img
                        src="/mbos-logo.png"
                        alt="Mbo's Tshisanyama"
                        className="admin-menu-logo"
                    />

                    <div>
                        <span>MBO’S</span>

                        <small>
                            STAFF MENU CONTROL
                        </small>
                    </div>
                </div>

                <div className="admin-menu-header-actions">
                    <a
                        href="/admin"
                        className="admin-menu-back-button"
                    >
                        BACK TO ORDERS
                    </a>
                </div>
            </header>

            {/* CONTENT */}

            <div className="admin-menu-container">

                {/* HEADING */}

                <section className="admin-menu-heading">
                    <div>
                        <p>RESTAURANT MENU</p>

                        <h1>
                            MENU
                            <span> CONTROL</span>
                        </h1>

                        <article>
                            Add products, update prices, manage
                            descriptions and control availability.
                        </article>
                    </div>

                    <div className="admin-menu-count">
                        <strong>{activeMenu.length}</strong>

                        <span>ACTIVE MENU ITEMS</span>
                    </div>
                </section>

                {/* TOOLBAR */}

                <div className="admin-menu-toolbar">
                    <div className="admin-menu-view-tabs">
                        <button
                            type="button"
                            className={
                                view === 'active'
                                    ? 'admin-menu-filter-button active'
                                    : 'admin-menu-filter-button'
                            }
                            onClick={() => setView('active')}
                        >
                            ACTIVE ({activeMenu.length})
                        </button>

                        <button
                            type="button"
                            className={
                                view === 'archived'
                                    ? 'admin-menu-filter-button active'
                                    : 'admin-menu-filter-button'
                            }
                            onClick={() => setView('archived')}
                        >
                            ARCHIVED ({archivedMenu.length})
                        </button>
                    </div>

                    <button
                        type="button"
                        className="admin-menu-add-button"
                        onClick={openCreateForm}
                        disabled={savingId === 'new'}
                    >
                        + ADD MENU ITEM
                    </button>
                </div>

                {/* MESSAGES */}

                {pageError && (
                    <div
                        className="admin-menu-error"
                        role="alert"
                    >
                        {pageError}
                    </div>
                )}

                {saveMessage && !pageError && (
                    <div
                        className="admin-menu-success"
                        role="status"
                    >
                        {saveMessage}
                    </div>
                )}

                {/* CREATE FORM */}

                {showCreateForm && (
                    <section className="admin-menu-create-panel">
                        <div className="admin-menu-create-heading">
                            <div>
                                <p>NEW PRODUCT</p>
                                <h2>ADD MENU ITEM</h2>
                            </div>

                            <button
                                type="button"
                                className="admin-menu-cancel-button"
                                onClick={closeCreateForm}
                                disabled={savingId === 'new'}
                            >
                                CLOSE
                            </button>
                        </div>

                        <form
                            className="admin-menu-create-form"
                            onSubmit={createItem}
                        >
                            <label>
                                <span>PRODUCT NAME</span>

                                <input
                                    type="text"
                                    name="name"
                                    value={newForm.name}
                                    onChange={handleNewFormChange}
                                    maxLength={100}
                                    placeholder="e.g. Quarter Chicken"
                                    required
                                />
                            </label>

                            <label>
                                <span>CATEGORY</span>

                                <input
                                    type="text"
                                    name="category"
                                    value={newForm.category}
                                    onChange={handleNewFormChange}
                                    maxLength={100}
                                    placeholder="e.g. Chicken"
                                    required
                                />
                            </label>

                            <label>
                                <span>PRICE (R)</span>

                                <input
                                    type="number"
                                    name="price"
                                    value={newForm.price}
                                    onChange={handleNewFormChange}
                                    min="0"
                                    max="100000"
                                    step="0.01"
                                    placeholder="0.00"
                                    required
                                />
                            </label>

                            <label>
                                <span>DESCRIPTION</span>

                                <textarea
                                    name="description"
                                    value={newForm.description}
                                    onChange={handleNewFormChange}
                                    maxLength={1000}
                                    rows={4}
                                    placeholder="Describe this menu item..."
                                />
                            </label>

                            <div className="admin-menu-create-actions">
                                <button
                                    type="button"
                                    className="admin-menu-cancel-button"
                                    onClick={closeCreateForm}
                                    disabled={savingId === 'new'}
                                >
                                    CANCEL
                                </button>

                                <button
                                    type="submit"
                                    className="admin-menu-save-button"
                                    disabled={savingId === 'new'}
                                >
                                    {savingId === 'new'
                                        ? 'ADDING ITEM...'
                                        : 'ADD TO MENU'}
                                </button>
                            </div>
                        </form>
                    </section>
                )}

                {/* MENU GRID */}

                {displayedMenu.length === 0 ? (
                    <section className="admin-menu-empty">
                        <span>
                            {view === 'archived'
                                ? 'NO ARCHIVED ITEMS'
                                : 'NO MENU ITEMS'}
                        </span>

                        <p>
                            {view === 'archived'
                                ? 'Archived products will appear here.'
                                : 'Add your first menu item to get started.'}
                        </p>
                    </section>
                ) : (
                    <section className="admin-menu-grid">
                        {displayedMenu.map((item) => {
                            const editing =
                                editingId === item.id;

                            const saving =
                                savingId === item.id;

                            const archived =
                                item.is_listed === false;

                            const cardClass = archived
                                ? 'admin-menu-card admin-menu-card-archived'
                                : item.available
                                    ? 'admin-menu-card'
                                    : 'admin-menu-card admin-menu-card-unavailable';

                            return (
                                <article
                                    key={item.id}
                                    className={cardClass}
                                >

                                    {/* CARD TOP */}

                                    <div className="admin-menu-card-top">
                                        <div>
                                            <span className="admin-menu-category">
                                                {item.category ||
                                                    'UNCATEGORISED'}
                                            </span>

                                            <strong>
                                                #{item.id}
                                            </strong>
                                        </div>

                                        {archived ? (
                                            <span className="admin-menu-archived-badge">
                                                ARCHIVED
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                className={
                                                    item.available
                                                        ? 'admin-menu-availability admin-menu-availability-on'
                                                        : 'admin-menu-availability admin-menu-availability-off'
                                                }
                                                onClick={() =>
                                                    toggleAvailability(item)
                                                }
                                                disabled={saving}
                                            >
                                                {saving
                                                    ? 'UPDATING...'
                                                    : item.available
                                                        ? 'AVAILABLE'
                                                        : 'SOLD OUT'}
                                            </button>
                                        )}
                                    </div>

                                    {editing ? (
                                        <div className="admin-menu-edit">

                                            <label>
                                                <span>NAME</span>

                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={editForm.name}
                                                    onChange={handleEditFormChange}
                                                    maxLength={100}
                                                />
                                            </label>

                                            <label>
                                                <span>CATEGORY</span>

                                                <input
                                                    type="text"
                                                    name="category"
                                                    value={editForm.category}
                                                    onChange={handleEditFormChange}
                                                    maxLength={100}
                                                />
                                            </label>

                                            <label>
                                                <span>PRICE</span>

                                                <input
                                                    type="number"
                                                    name="price"
                                                    min="0"
                                                    step="0.01"
                                                    value={editForm.price}
                                                    onChange={handleEditFormChange}
                                                />
                                            </label>

                                            <label>
                                                <span>DESCRIPTION</span>

                                                <textarea
                                                    name="description"
                                                    value={editForm.description}
                                                    onChange={handleEditFormChange}
                                                    maxLength={1000}
                                                    rows={4}
                                                />
                                            </label>

                                            <div className="admin-menu-edit-actions">
                                                <button
                                                    type="button"
                                                    className="admin-menu-cancel-button"
                                                    onClick={cancelEditing}
                                                    disabled={saving}
                                                >
                                                    CANCEL
                                                </button>

                                                <button
                                                    type="button"
                                                    className="admin-menu-save-button"
                                                    onClick={() =>
                                                        saveItem(item.id)
                                                    }
                                                    disabled={saving}
                                                >
                                                    {saving
                                                        ? 'SAVING...'
                                                        : 'SAVE CHANGES'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="admin-menu-card-content">
                                                <h2>{item.name}</h2>

                                                <p>
                                                    {item.description ||
                                                        'No description added.'}
                                                </p>
                                            </div>

                                            <div className="admin-menu-card-bottom">
                                                <strong>
                                                    {formatMoney(item.price)}
                                                </strong>

                                                <button
                                                    type="button"
                                                    className="admin-menu-edit-button"
                                                    onClick={() =>
                                                        startEditing(item)
                                                    }
                                                    disabled={saving}
                                                >
                                                    EDIT ITEM
                                                </button>
                                            </div>

                                            <div className="admin-menu-card-management">
                                                {archived ? (
                                                    <button
                                                        type="button"
                                                        className="admin-menu-restore-button"
                                                        onClick={() =>
                                                            restoreItem(item)
                                                        }
                                                        disabled={saving}
                                                    >
                                                        {saving
                                                            ? 'RESTORING...'
                                                            : 'RESTORE TO MENU'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="admin-menu-archive-button"
                                                        onClick={() =>
                                                            archiveItem(item)
                                                        }
                                                        disabled={saving}
                                                    >
                                                        {saving
                                                            ? 'REMOVING...'
                                                            : 'REMOVE FROM MENU'}
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </article>
                            );
                        })}
                    </section>
                )}
            </div>
        </main>
    );
}

export default AdminMenu;