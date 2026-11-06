import { Placeholder } from '../components/shell/Placeholder';
import { ListGroup, ListRow } from '../components/ui';
export default function Me() {
  return (
    <Placeholder title="Me" actions settings>
      <ListGroup header="Your Training">
        <ListRow title="Edit Profile" to="/me/edit" />
        <ListRow title="Weekly Target" to="/me/target" />
        <ListRow title="Plan" to="/plan" />
        <ListRow title="Settings" to="/settings" />
      </ListGroup>
    </Placeholder>
  );
}
