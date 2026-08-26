class ChangeInboxesTimezoneDefaultToWarsaw < ActiveRecord::Migration[7.2]
  # KLIMABAZAR F-transkrypcja: nowe skrzynki domyslnie w strefie Europe/Warsaw
  def up
    change_column_default :inboxes, :timezone, from: 'UTC', to: 'Europe/Warsaw'
  end

  def down
    change_column_default :inboxes, :timezone, from: 'Europe/Warsaw', to: 'UTC'
  end
end
