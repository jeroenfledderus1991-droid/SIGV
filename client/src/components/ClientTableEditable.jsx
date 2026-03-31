import ClientTable from "./ClientTable.jsx";

export default function ClientTableEditable({
  enableInlineEdit = true,
  enableRowAdd = true,
  editableColumns = {},
  ...props
}) {
  return (
    <ClientTable
      {...props}
      enableInlineEdit={enableInlineEdit}
      enableRowAdd={enableRowAdd}
      editableColumns={editableColumns}
    />
  );
}
