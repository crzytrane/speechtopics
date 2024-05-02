-- Migration number: 0001 	 2024-05-02T10:05:22.615Z

create table MailingList (
	id integer primary key autoincrement,
	email text not null,
	created datetime default current_timestamp,
	confirmed boolean default false,
	code text not null default ''
);

create index if not exists idx_MailingList_lookup on MailingList(email, confirmed, created);
create index if not exists idx_MailingList_dailysending on MailingList(confirmed, created, email);

